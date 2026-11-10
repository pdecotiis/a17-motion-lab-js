import type { MotionVersion, EntranceVersion, PageConfig, StateValues, TransitionTiming } from './types.js';
import type { Runtime } from './runtime.js';
import { findRefs } from './token-compiler.js';
import { hasEntrance, stepsOf } from './motion-models.js';
import { versionForElementPreset } from './preset-interaction.js';
import { presetOf } from './entrance-presets.js';

export interface TokenRefs {
  tokens: string[];
  hardcoded: { label: string; value: string }[];
}

export interface UsageEntry {
  componentName: string;
  versionId: string;
  versionLabel: string;
}

export type UsageIndex = Map<string, UsageEntry[]>;

// What one motion (the component's root, or one layer) uses: each token and where in the motion it
// sits ("duration", "easing", "delay", "stagger", "0% transform"), plus any
// hard-coded values.
export interface StepRefs {
  /** The layer's data-motion name; null for the component's root. */
  layer: string | null;
  /** For an element that uses a preset's hover and press: the preset (the panel adds a short list of its states). */
  preset?: string;
  uses: { token: string; where: string[] }[];
  hardcoded: { label: string; value: string }[];
}

function stepRefs(layer: string | null, version: EntranceVersion, raw: Record<string, unknown>, withStagger: boolean, runtime?: Runtime, globalBounce?: string): StepRefs {
  const uses = new Map<string, string[]>();
  const hardcoded: { label: string; value: string }[] = [];
  const use = (token: string, where: string): void => {
    const places = uses.get(token) ?? [];
    if (!places.includes(where)) places.push(where);
    uses.set(token, places);
  };

  function check(value: string | undefined, label: string): void {
    if (!value) return;
    if (value in raw) use(value, label);
    else if (value !== '0ms' && value !== '0') hardcoded.push({ label, value });
  }

  // An interaction version names its tokens per transition (into each state) and in each state's values.
  if (version.interaction) {
    // The component's own transitions and states, then each layer's (its label starts with the layer's name).
    const timings = (prefix: string, transitions: Record<string, TransitionTiming>): void => {
      for (const [state, t] of Object.entries(transitions)) {
        check(t.duration, `${prefix}into ${state} duration`);
        if (runtime !== 'motion') check(t.easing, `${prefix}into ${state} easing`);
        if (t.delay) check(t.delay, `${prefix}into ${state} delay`);
        const own = t.model === 'spring' ? t.bounce : undefined;
        if (runtime === 'motion') {
          if (typeof own === 'number') hardcoded.push({ label: `${prefix}into ${state} bounce`, value: String(own) });
          else if (own ?? globalBounce) check(own ?? globalBounce, `${prefix}into ${state} bounce`);
        } else if (runtime === undefined && own !== undefined) {
          if (typeof own === 'number') hardcoded.push({ label: `${prefix}into ${state} bounce`, value: String(own) });
          else check(own, `${prefix}into ${state} bounce`);
        }
      }
    };
    const stateRefs = (prefix: string, states: Record<string, StateValues>): void => {
      for (const [state, values] of Object.entries(states)) {
        for (const [prop, v] of Object.entries(values)) {
          if (typeof v === 'string') findRefs(v).filter(p => p in raw).forEach(p => use(p, `${prefix}${state} ${prop}`));
        }
      }
    };
    timings('', version.interaction.transitions);
    stateRefs('', version.interaction.states);
    for (const [layer, part] of Object.entries(version.interaction.layers ?? {})) {
      timings(`${layer} `, part.transitions ?? {});
      stateRefs(`${layer} `, part.states);
    }
    if (withStagger && version.stagger) check(version.stagger, 'stagger');
    return { layer, uses: [...uses].map(([token, where]) => ({ token, where })), hardcoded };
  }

  const m = version.model;
  check(m.duration, 'duration');
  // Under Motion everything plays as a spring, from its duration and bounce: easing is CSS only.
  if (runtime !== 'motion') check(m.easing, 'easing');
  if (m.delay) check(m.delay, 'delay');
  // The bounce a spring plays with. Under Motion every motion has one: its own, else the global setting.
  // As authored (no runtime) only a spring that names its own counts; under CSS none does.
  const own = m.model === 'spring' ? m.bounce : undefined;
  if (runtime === 'motion') {
    if (typeof own === 'number') hardcoded.push({ label: 'bounce', value: String(own) });
    else if (own ?? globalBounce) check(own ?? globalBounce, 'bounce');
  } else if (runtime === undefined && own !== undefined) {
    if (typeof own === 'number') hardcoded.push({ label: 'bounce', value: String(own) });
    else check(own, 'bounce');
  }
  if (withStagger && version.stagger) check(version.stagger, 'stagger');

  if (m.model === 'tween') {
    const kfs = version.keyframes ?? [];
    kfs.forEach((kf, i) => {
      const at = `${Math.round((typeof kf.offset === 'number' ? kf.offset : kfs.length === 1 ? 1 : i / (kfs.length - 1)) * 100)}%`;
      for (const [prop, v] of Object.entries(kf)) {
        if (typeof v === 'string') findRefs(v).filter(p => p in raw).forEach(p => use(p, `${at} ${prop}`));
      }
    });
  }

  return { layer, uses: [...uses].map(([token, where]) => ({ token, where })), hardcoded };
}

// The tokens each motion of a version uses: the root first, then each layer. The stagger belongs
// to the version, so it is listed with the root. With a runtime, it is what that runtime uses: under
// Motion nothing uses an easing (every motion is a spring) and each uses a bounce: its own, else
// `globalBounce`. Without a runtime, the version as authored (what exports).
export function getStepRefs(version: MotionVersion, raw: Record<string, unknown>, runtime?: Runtime, globalBounce?: string): StepRefs[] {
  // A preset on an element is up to two motions (a fade and a move): each is a group, named "title fade", "title move".
  const steps = stepsOf(version).map(({ name, track, version: step }, i) => {
    const label = track && track !== 'all' ? `${name ?? 'root'} ${track}` : name;
    return stepRefs(label, step, raw, i === 0, runtime, globalBounce);
  });
  // A version with an entrance and states: the states' tokens are a group of their own, after the entrance's.
  if (version.interaction && hasEntrance(version)) {
    steps.push(stepRefs('states', { ...version, model: version.model! } as EntranceVersion, raw, false, runtime, globalBounce));
  }
  // Elements that use a preset's hover and press: a group each, "<element> · <preset>", with what hovered and pressed use ("into pressed duration", "pressed transform").
  for (const [name, preset] of Object.entries(version.elements ?? {})) {
    const group = stepRefs(name === 'root' ? `${preset} preset` : `${name} · ${preset} preset`, versionForElementPreset(version, preset) as EntranceVersion, raw, false, runtime, globalBounce);
    // In the designer's words: pressing, letting go (into hovered), and leaving (into default); the scale is the press's.
    const words = (where: string): string => where
      .replace('into pressed ', 'press ').replace('into hovered ', 'hover, release ').replace('into default ', 'leave ')
      .replace('pressed transform', 'press scale').replace('hovered filter', 'hover tint').replace('pressed filter', 'press tint');
    group.preset = preset;
    group.uses = group.uses.map(u => ({ ...u, where: [...new Set(u.where.map(words))] }));
    steps.push(group);
  }
  return steps;
}

/** The tokens a preset's states play, state by state (hovered, pressed, release), for the Details panel. An easing only under CSS. */
export function presetStateTokens(preset: string, runtime?: Runtime): { state: string; uses: { token: string; where: string }[] }[] {
  const ix = presetOf(preset).interaction;
  if (!ix) return [];
  const timing = (t: { duration: string; easing: string }): { token: string; where: string }[] => [
    { token: t.duration, where: 'duration' }, ...(runtime === 'motion' ? [] : [{ token: t.easing, where: 'easing' }]),
  ];
  const out: { state: string; uses: { token: string; where: string }[] }[] = [];
  if (ix.hover) out.push({ state: 'hovered', uses: timing(ix.hover.timing) });
  if (ix.press) {
    out.push({ state: 'pressed', uses: [{ token: ix.press.scale, where: 'scale' }, ...timing(ix.press.timing)] });
    out.push({ state: 'release', uses: timing(ix.press.release) });
  }
  return out;
}

// Every token a version uses, across its root and layers, and its hard-coded values (a layer's are
// labelled with its name).
export function getTokenRefs(version: MotionVersion, raw: Record<string, unknown>): TokenRefs {
  const steps = getStepRefs(version, raw);
  return {
    tokens: [...new Set(steps.flatMap(s => s.uses.map(u => u.token)))],
    hardcoded: steps.flatMap(s => s.hardcoded.map(h => (s.layer ? { ...h, label: `${s.layer} ${h.label}` } : h))),
  };
}

function ms(value: string | undefined, raw: Record<string, unknown>): number | undefined {
  const v = value !== undefined && value in raw ? raw[value] : value;
  return typeof v === 'string' && /^[\d.]+m?s$/.test(v) ? (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000) : undefined;
}

// Pairing rules, as warnings and never errors: productive easings pair with 50–300ms, expressive
// easings with 400–1200ms. A layer's
// warnings start with its name. Under Motion nothing plays an easing, so there is nothing to pair.
export function pairingWarnings(version: MotionVersion, raw: Record<string, unknown>, runtime?: Runtime): string[] {
  // An interaction version pairs each transition's duration with its easing; a motion otherwise.
  const stateMotions = version.interaction
    ? [
        ...Object.entries(version.interaction.transitions).map(([state, t]) => ({ name: `into ${state}` as string | null, model: t as { duration: string; easing: string } })),
        ...Object.entries(version.interaction.layers ?? {}).flatMap(([layer, part]) => Object.entries(part.transitions ?? {}).map(([state, t]) => ({ name: `${layer} into ${state}` as string | null, model: t as { duration: string; easing: string } }))),
      ]
    : [];
  const motions = [
    ...(version.interaction && !hasEntrance(version) ? [] : stepsOf(version).map(({ name, version: step }) => ({ name, model: step.model }))),
    ...stateMotions,
  ];
  return motions.flatMap(({ name, model }) => {
    const { duration, easing } = model;
    if (!(easing in raw) || runtime === 'motion') return [];
    const eName = easing.slice(easing.indexOf('.') + 1);
    const warnings: string[] = [];
    const time = ms(duration, raw);
    if (time !== undefined) {
      if (eName.startsWith('productive-') && (time < 50 || time > 300)) {
        warnings.push(`${eName} is a productive easing: pair it with 50–300ms, not ${time}ms`);
      }
      if (eName.startsWith('expressive-') && (time < 400 || time > 1200)) {
        warnings.push(`${eName} is an expressive easing: pair it with 400–1200ms, not ${time}ms`);
      }
    }
    return name ? warnings.map(w => `${name}: ${w}`) : warnings;
  });
}

export function buildUsageIndex(
  allVersions: { componentName: string; version: MotionVersion }[],
  raw: Record<string, unknown>,
): UsageIndex {
  const index: UsageIndex = new Map();
  for (const { componentName, version } of allVersions) {
    const { tokens } = getTokenRefs(version, raw);
    for (const tokenPath of tokens) {
      const entries = index.get(tokenPath) ?? [];
      entries.push({ componentName, versionId: version.id, versionLabel: version.label });
      index.set(tokenPath, entries);
    }
  }
  return index;
}

// Maps token path → page ids. Pages don't pin versions, so each component
// instance counts as its component's default version.
export type PageUsageIndex = Map<string, string[]>;

export function buildPageUsageIndex(
  pages: PageConfig[],
  defaultVersions: Map<string, MotionVersion>,
  raw: Record<string, unknown>,
): PageUsageIndex {
  const index: PageUsageIndex = new Map();
  for (const page of pages) {
    for (const { component } of page.components) {
      const version = defaultVersions.get(component);
      if (!version) continue;
      for (const tokenPath of getTokenRefs(version, raw).tokens) {
        const pageIds = index.get(tokenPath) ?? [];
        if (!pageIds.includes(page.id)) pageIds.push(page.id);
        index.set(tokenPath, pageIds);
      }
    }
  }
  return index;
}
