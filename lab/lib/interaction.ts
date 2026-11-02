import type { Interaction, InteractionTrigger, MotionVersion, StateValues, TransitionTiming, TriggerEvent } from './types.js';
import { resolveBounce, DEFAULT_BOUNCE } from './bounce.js';
import { resolveRefs, findRefs } from './token-compiler.js';
import { transformParts, TRANSFORM_IDENTITY } from './transform.js';
import { REDUCED_MOTION_FADE_MS } from './reduced-motion.js';

// Interactions (spike): a component's states and the transitions between them. Pure maths and plans:
// what each runtime is asked to do when the component goes to a state. The DOM side is
// interaction-player.ts.

const STRUCTURAL = ['display', 'position', 'width', 'height', 'content', 'innerHTML'];

/** The events a trigger can listen for. */
export const TRIGGER_EVENTS: readonly TriggerEvent[] = ['hover', 'press', 'focus', 'click'];

const NAME = /^[a-z0-9][a-z0-9-]*$/;

// What a property is when nothing is applied. A state that leaves a property out has it at this value.
export const NATURAL_VALUES: Record<string, string | number> = { opacity: 1, transform: 'none', filter: 'none', clipPath: 'none' };

function parseMs(value: string | undefined, raw: Record<string, unknown>): number {
  if (value === undefined) return 0;
  const v = value in raw ? raw[value] : value;
  if (typeof v !== 'string') return 0;
  return v.endsWith('ms') ? parseFloat(v) : v.endsWith('s') ? parseFloat(v) * 1000 : parseFloat(v);
}

function cubicBezier(easing: string, raw: Record<string, unknown>): string {
  const v = easing in raw ? raw[easing] : easing;
  if (Array.isArray(v) && v.length === 4) return `cubic-bezier(${v.join(', ')})`;
  return typeof v === 'string' ? v : 'ease';
}

/** The motion properties the states animate, in a stable order. */
export function stateProps(interaction: Interaction): string[] {
  return [...new Set(Object.values(interaction.states).flatMap(s => Object.keys(s)))];
}

/** The state names, the resting one first. */
export function stateNames(interaction: Interaction): string[] {
  return [interaction.initial, ...Object.keys(interaction.states).filter(s => s !== interaction.initial)];
}

function validateTiming(version: MotionVersion, where: string, t: TransitionTiming | undefined): void {
  if (!t) throw new Error(`MotionVersion "${version.id}" has no transition ${where}`);
  if (typeof t.duration !== 'string' || typeof t.easing !== 'string') throw new Error(`MotionVersion "${version.id}" transition ${where} needs a duration and an easing`);
  if (t.model === 'spring' && t.bounce !== undefined && !(typeof t.bounce === 'string' || (typeof t.bounce === 'number' && t.bounce >= 0 && t.bounce <= 1))) {
    throw new Error(`MotionVersion "${version.id}" transition ${where}: bounce must be a bounce token or a number from 0 to 1`);
  }
}

function validateTrigger(version: MotionVersion, t: InteractionTrigger, names: string[], initial: string): void {
  const id = `MotionVersion "${version.id}"`;
  if (!TRIGGER_EVENTS.includes(t.on)) throw new Error(`${id} has an unknown trigger "${String(t.on)}" (use ${TRIGGER_EVENTS.join(', ')})`);
  if (t.target !== undefined && !NAME.test(t.target)) throw new Error(`${id} trigger target "${t.target}" must be lowercase letters, numbers and hyphens, as in data-motion="${t.target}"`);
  const known = (s: unknown, what: string): void => { if (typeof s !== 'string' || !names.includes(s)) throw new Error(`${id} ${t.on} trigger ${what} "${String(s)}", which is not one of its states (${names.join(', ')})`); };
  if (t.on === 'click') {
    const hasSet = 'set' in t && t.set !== undefined, hasToggle = 'toggle' in t && t.toggle !== undefined;
    if (hasSet === hasToggle) throw new Error(`${id} click trigger needs either "set" (a state) or "toggle" (two states), not both or neither`);
    if (hasSet) known((t as { set: string }).set, 'sets');
    else {
      const pair = (t as { toggle: [string, string] }).toggle;
      if (!Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1]) throw new Error(`${id} click toggle needs two different states`);
      pair.forEach(s => known(s, 'toggles'));
    }
    return;
  }
  known((t as { state: string }).state, 'goes to');
  if ((t as { state: string }).state === initial) throw new Error(`${id} ${t.on} trigger goes to "${initial}", the resting state: it should go to another state, and come back to rest when it ends`);
}

export function validateInteraction(version: MotionVersion): void {
  const i = version.interaction;
  if (!i) return;
  const names = Object.keys(i.states ?? {});
  if (names.length < 2) throw new Error(`MotionVersion "${version.id}" interaction needs at least two states`);
  if (!names.includes(i.initial)) throw new Error(`MotionVersion "${version.id}" interaction starts in "${i.initial}", which is not one of its states (${names.join(', ')})`);
  for (const [name, values] of Object.entries(i.states)) {
    for (const prop of Object.keys(values)) {
      if (STRUCTURAL.includes(prop)) throw new Error(`MotionVersion "${version.id}" state "${name}" contains structural property: "${prop}"`);
    }
  }
  for (const name of names) validateTiming(version, `into state "${name}"`, i.transitions?.[name]);
  for (const name of Object.keys(i.transitions)) {
    if (!names.includes(name)) throw new Error(`MotionVersion "${version.id}" has a transition into "${name}", which is not one of its states`);
  }

  // Layers: values for the states, and optionally their own timing into them.
  for (const [layer, part] of Object.entries(i.layers ?? {})) {
    if (!NAME.test(layer)) throw new Error(`MotionVersion "${version.id}" interaction layer name "${layer}" must be lowercase letters, numbers and hyphens, as in data-motion="${layer}"`);
    for (const [state, values] of Object.entries(part.states ?? {})) {
      if (!names.includes(state)) throw new Error(`MotionVersion "${version.id}" layer "${layer}" has values for "${state}", which is not one of its states (${names.join(', ')})`);
      for (const prop of Object.keys(values)) {
        if (STRUCTURAL.includes(prop)) throw new Error(`MotionVersion "${version.id}" layer "${layer}" state "${state}" contains structural property: "${prop}"`);
      }
    }
    for (const [state, t] of Object.entries(part.transitions ?? {})) {
      if (!names.includes(state)) throw new Error(`MotionVersion "${version.id}" layer "${layer}" has a transition into "${state}", which is not one of its states`);
      validateTiming(version, `into "${state}" for layer "${layer}"`, t);
    }
  }

  // Triggers: what moves it between states.
  const seen = new Set<string>();
  for (const t of i.triggers ?? []) {
    validateTrigger(version, t, names, i.initial);
    const key = `${t.on}@${t.target ?? ''}`;
    if (seen.has(key)) throw new Error(`MotionVersion "${version.id}" has two ${t.on} triggers on ${t.target ? `"${t.target}"` : 'the component'}`);
    seen.add(key);
  }
}

/** Whether the version has triggers a person does with a pointer or the keyboard (hover, press, focus), as opposed to clicks. */
export function hasHoldTriggers(interaction: Interaction): boolean {
  return (interaction.triggers ?? []).some(t => t.on === 'hover' || t.on === 'press' || t.on === 'focus');
}

/** The layers that have values for the states. */
export function layerNames(interaction: Interaction): string[] {
  return Object.keys(interaction.layers ?? {});
}

/** The motion properties a part (the root when `target` is null, else a layer) changes across its states. */
export function partProps(interaction: Interaction, target: string | null): string[] {
  const states = target === null ? interaction.states : (interaction.layers?.[target]?.states ?? {});
  return [...new Set(Object.values(states).flatMap(s => Object.keys(s)))];
}

/**
 * A part's values in a state: every property it changes in any state, a property the state leaves out at
 * its natural value (opacity 1, no transform), so each state describes the whole part.
 */
export function partValues(interaction: Interaction, target: string | null, state: string): StateValues {
  const states = target === null ? interaction.states : (interaction.layers?.[target]?.states ?? {});
  const own = states[state] ?? {};
  return Object.fromEntries(partProps(interaction, target).map(prop => {
    if (prop in own) return [prop, own[prop]!];
    if (!(prop in NATURAL_VALUES)) throw new Error(`State "${state}" leaves out "${prop}", which has no natural value: give every state a value for it`);
    return [prop, NATURAL_VALUES[prop]!];
  }));
}

/** The timing of a part going to a state: the layer's own where it has one, else the component's. */
export function timingFor(interaction: Interaction, target: string | null, state: string): TransitionTiming {
  return (target !== null ? interaction.layers?.[target]?.transitions?.[state] : undefined) ?? transitionInto(interaction, state);
}

/** The parts that move: the root first, then each layer that has values. */
export function interactionParts(interaction: Interaction): (string | null)[] {
  return [null, ...layerNames(interaction)];
}

/** A state's values with token references resolved ("translateX({distance.48})" → "translateX(48px)"). */
export function resolveState(values: StateValues, raw: Record<string, unknown>): StateValues {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === 'string' ? resolveRefs(v, raw) : v]));
}

/** The token paths a state's values name. */
export function stateRefs(values: StateValues): string[] {
  return Object.values(values).flatMap(v => (typeof v === 'string' ? findRefs(v) : []));
}

export function transitionInto(interaction: Interaction, state: string): TransitionTiming {
  const t = interaction.transitions[state];
  if (!t) throw new Error(`No transition into state "${state}"`);
  return t;
}

// ── CSS (WAAPI) ────────────────────────────────────────────────────────────

export interface CssTransitionPlan {
  /** Values to animate to. */
  animate: StateValues;
  /** Values that apply at once (the movement, under reduced motion). */
  snap: StateValues;
  duration: number;
  delay: number;
  easing: string;
  note?: string;
}

// Going to a state in CSS: its values along the transition's easing curve (a spring is easing here: the
// lab simulates no springs). Reduced motion keeps the opacity change and snaps the rest.
export function cssTransitionPlan(
  interaction: Interaction,
  to: string,
  raw: Record<string, unknown>,
  options: { reducedMotion?: boolean; reducedPolicy?: 'fade' | 'none'; target?: string | null } = {},
): CssTransitionPlan {
  const { reducedMotion = false, reducedPolicy = 'fade', target = null } = options;
  const t = timingFor(interaction, target, to);
  const values = resolveState(partValues(interaction, target, to), raw);
  const base = { duration: parseMs(t.duration, raw), delay: parseMs(t.delay, raw), easing: cubicBezier(t.easing, raw) };
  const note = t.model === 'spring' ? 'authored as a spring; CSS plays its easing' : undefined;

  if (reducedMotion) {
    const fade = reducedPolicy === 'fade' && 'opacity' in values;
    const { opacity, ...rest } = values;
    return {
      animate: fade ? { opacity: opacity! } : {},
      snap: fade ? rest : values,
      ...base,
      duration: Math.min(base.duration, REDUCED_MOTION_FADE_MS),
      ...(note ? { note } : {}),
    };
  }
  return { animate: values, snap: {}, ...base, ...(note ? { note } : {}) };
}

// ── Motion ─────────────────────────────────────────────────────────────────

/** A state's values as Motion animates them: independent transforms (x, y, scale) so a spring carries its speed. */
export type MotionValues = Record<string, number | string>;

// Every state in Motion's terms, with the same properties in each (a transform property one state
// leaves out is its resting value there), so going from any state to any other is a plain from → to.
export function motionStates(interaction: Interaction, raw: Record<string, unknown>, target: string | null = null): Record<string, MotionValues> {
  const resolved = Object.fromEntries(Object.keys(interaction.states).map(n => [n, resolveState(partValues(interaction, target, n), raw)]));
  const parts = Object.fromEntries(Object.entries(resolved).map(([n, v]) => [n, typeof v['transform'] === 'string' ? transformParts(v['transform']) : { props: {}, unsupported: [] }]));
  const transformKeys = [...new Set(Object.values(parts).flatMap(p => Object.keys(p.props)))];
  const out: Record<string, MotionValues> = {};
  for (const [name, values] of Object.entries(resolved)) {
    const { transform: _t, ...rest } = values;
    const m: MotionValues = { ...rest };
    for (const k of transformKeys) m[k] = parts[name]!.props[k] ?? TRANSFORM_IDENTITY[k] ?? 0;
    out[name] = m;
  }
  return out;
}

export interface MotionTransitionPlan {
  animate: MotionValues;
  snap: MotionValues;
  options: { type: 'spring'; visualDuration: number; bounce: number; delay: number };
  bounceToken?: string;
  note?: string;
}

// Going to a state in Motion: always a spring (the duration is when it visually arrives), with the
// transition's own bounce or the global one. Reduced motion keeps the opacity change as a spring with
// no bounce and snaps the rest.
export function motionTransitionPlan(
  interaction: Interaction,
  to: string,
  raw: Record<string, unknown>,
  options: { reducedMotion?: boolean; reducedPolicy?: 'fade' | 'none'; globalBounce?: string; target?: string | null } = {},
): MotionTransitionPlan {
  const { reducedMotion = false, reducedPolicy = 'fade', globalBounce = DEFAULT_BOUNCE, target = null } = options;
  const t = timingFor(interaction, target, to);
  const values = motionStates(interaction, raw, target)[to]!;
  const own = t.model === 'spring' ? t.bounce : undefined;
  const bounceToken = typeof own === 'number' ? undefined : (own ?? globalBounce);
  const ms = parseMs(t.duration, raw);
  const delay = parseMs(t.delay, raw) / 1000;
  const notes: string[] = [];
  if (own === undefined && !reducedMotion) notes.push(t.model === 'tween' ? 'authored as easing; bounce is the global setting' : 'bounce is the global setting');

  if (reducedMotion) {
    const fade = reducedPolicy === 'fade' && 'opacity' in values;
    const { opacity, ...rest } = values;
    if (t.model === 'spring') notes.push('reduced motion: opacity fade, no bounce');
    return {
      animate: fade ? { opacity: opacity! } : {},
      snap: fade ? rest : values,
      options: { type: 'spring', visualDuration: Math.min(ms, REDUCED_MOTION_FADE_MS) / 1000, bounce: 0, delay },
      ...(notes.length ? { note: notes.join('; ') } : {}),
    };
  }
  return {
    animate: values,
    snap: {},
    options: { type: 'spring', visualDuration: ms / 1000, bounce: resolveBounce(own ?? globalBounce, raw), delay },
    ...(bounceToken ? { bounceToken } : {}),
    ...(notes.length ? { note: notes.join('; ') } : {}),
  };
}

// ── What plays, in a line ──────────────────────────────────────────────────

// "into open: Easing · expressive-entrance, 560ms (authored as a spring; CSS plays its easing)" or
// "into open: Spring · bounce 0.5 (bounce.50), 560ms".
export function describeTransition(
  interaction: Interaction,
  to: string,
  raw: Record<string, unknown>,
  runtime: 'css' | 'motion',
  options: { globalBounce?: string } = {},
): string {
  if (runtime === 'motion') {
    const p = motionTransitionPlan(interaction, to, raw, options);
    const token = p.bounceToken ? ` (${p.bounceToken})` : '';
    const text = `Spring · bounce ${p.options.bounce}${token}, ${Math.round(p.options.visualDuration * 1000)}ms`;
    return `into ${to}: ${p.note ? `${text} (${p.note})` : text}`;
  }
  const p = cssTransitionPlan(interaction, to, raw);
  const t = transitionInto(interaction, to);
  const text = `Easing · ${t.easing.slice(t.easing.indexOf('.') + 1)}, ${Math.round(p.duration)}ms`;
  return `into ${to}: ${p.note ? `${text} (${p.note})` : text}`;
}
