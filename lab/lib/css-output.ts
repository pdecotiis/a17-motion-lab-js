import type { Interaction, MotionVersion, EntranceVersion, SpringProperty } from './types.js';
import { resolveRefs, tokenVarName } from './token-compiler.js';
import { hasEntrance, stepsOf, type StepEntry } from './motion-models.js';
import { PRESET_NAMES, presetOf, presetTracks, type PresetName } from './entrance-presets.js';
import { interactionParts, partProps, partValues, stateNames, timingFor } from './interaction.js';
import { REDUCED_MOTION_FADE_MS } from './reduced-motion.js';
import { describeTrigger, getReducedMotionPolicy } from './version-meta.js';

// Stack-neutral CSS for a version: named @keyframes, a class that applies them, token custom
// properties (with the literal value as fallback, so the file works without tokens.css),
// and a prefers-reduced-motion block. Plain CSS, so it ports to any stack; a developer on GSAP
// or Motion reads the same numbers from it.

export interface CssOptions {
  // Used in the class and @keyframes names: .motion-<component>-<version>.
  component?: string;
  // Put the shared preset definitions (presets.css) above the component's CSS: the Generated code panel does,
  // the spec writes them to a file of their own.
  includePresets?: boolean;
}

function parseMs(value: string): number {
  if (value.endsWith('ms')) return parseFloat(value);
  if (value.endsWith('s')) return parseFloat(value) * 1000;
  return parseFloat(value);
}

// A token path or literal → its literal value (no var()).
function literalValue(value: string | undefined, raw: Record<string, unknown>, fallback: string): string {
  if (!value) return fallback;
  if (value in raw) {
    const v = raw[value];
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return `cubic-bezier(${(v as number[]).join(', ')})`;
  }
  return value;
}

// Same, but a known token becomes var(--token, literal).
function cssValue(value: string | undefined, raw: Record<string, unknown>, fallback: string): string {
  const literal = literalValue(value, raw, fallback);
  const isToken = value !== undefined && value in raw && (typeof raw[value] === 'string' || Array.isArray(raw[value]));
  return isToken ? `var(${tokenVarName(value)}, ${literal})` : literal;
}

function kebab(prop: string): string {
  return prop.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
}

function pct(offset: number): string {
  return `${Math.round(offset * 1000) / 10}%`;
}

function declarations(kf: Keyframe, raw: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(kf)) {
    if (k === 'offset' || k === 'composite') continue;
    const value = typeof v === 'string' ? resolveRefs(v, raw, { cssVars: true }) : String(v);
    out.push(`${k === 'easing' ? 'animation-timing-function' : kebab(k)}: ${value};`);
  }
  return out;
}

function keyframesBlock(name: string, frames: { at: string; decls: string[] }[], indent = ''): string[] {
  const lines = [`${indent}@keyframes ${name} {`];
  for (const f of frames) {
    lines.push(`${indent}  ${f.at} {`);
    for (const d of f.decls) lines.push(`${indent}    ${d}`);
    lines.push(`${indent}  }`);
  }
  lines.push(`${indent}}`);
  return lines;
}

// Keyframes in offset order; a keyframe without an offset is spaced evenly, as in WAAPI.
export function orderedKeyframes(keyframes: Keyframe[]): { offset: number; kf: Keyframe }[] {
  const n = keyframes.length;
  return keyframes
    .map((kf, i) => ({ offset: typeof kf.offset === 'number' ? kf.offset : n === 1 ? 1 : i / (n - 1), kf }))
    .sort((a, b) => a.offset - b.offset);
}

function tweenFrames(keyframes: Keyframe[], raw: Record<string, unknown>): { at: string; decls: string[] }[] {
  return orderedKeyframes(keyframes).map(({ offset, kf }) => ({ at: pct(offset), decls: declarations(kf, raw) }));
}

function springDecls(props: SpringProperty[], end: 'from' | 'to'): string[] {
  const decls: string[] = [];
  const transforms: string[] = [];
  for (const p of props) {
    const v = `${p[end]}${p.unit ?? ''}`;
    if (p.wrapTransform) transforms.push(`${p.wrapTransform}(${v})`);
    else decls.push(`${kebab(p.property)}: ${v};`);
  }
  if (transforms.length) decls.push(`transform: ${transforms.join(' ')};`);
  return decls;
}

function springFrames(props: SpringProperty[]): { at: string; decls: string[] }[] {
  return [
    { at: 'from', decls: springDecls(props, 'from') },
    { at: 'to', decls: springDecls(props, 'to') },
  ];
}

// Lines for the animation-delay declaration: the version's delay plus, when it staggers,
// an index the developer sets on each sibling (--motion-index: 0, 1, 2, …). `delay` is the literal value
// (to tell whether there is one); `delayCss` is what is written: a delay token stays var(--motion-delay-40, 40ms),
// so changing the token changes the delay, like every other token in the file.
function delayLines(delay: string, delayCss: string, stagger: string | undefined): string[] {
  const hasDelay = delay !== '0ms' && delay !== '0s' && delay !== '0';
  if (stagger) {
    const base = hasDelay ? `${delayCss} + ` : '';
    return [
      '/* Stagger: set --motion-index to 0, 1, 2… on each sibling. */',
      `animation-delay: calc(${base}var(--motion-index, 0) * ${stagger});`,
    ];
  }
  return hasDelay ? [`animation-delay: ${delayCss};`] : [];
}

function block(selector: string, lines: string[], indent = ''): string[] {
  return [`${indent}${selector} {`, ...lines.map(l => `${indent}  ${l}`), `${indent}}`];
}

// One motion (the root's or a layer's) as @keyframes, a class and its reduced-motion block.
// `fill` is 'both' (the end state stays) unless the states take over from the entrance: 'backwards', so once it ends the
// resting state and its transitions apply instead of the animation's last frame.
function stepCss(version: EntranceVersion, raw: Record<string, unknown>, name: string, stagger: string | undefined, fill: 'both' | 'backwards' = 'both'): string[] {
  const out: string[] = [];

  // A spring version has no real spring in CSS: it plays its from/to values with the easing curve.
  const model = version.model;
  const kfs = model.model === 'tween' ? (version.keyframes ?? []) : null;
  const frames = model.model === 'spring' ? springFrames(model.properties) : kfs!.length >= 2 ? tweenFrames(kfs!, raw) : null;
  const duration = cssValue(model.duration, raw, '300ms');
  const easing = cssValue(model.easing, raw, 'ease');
  const delay = literalValue(model.delay, raw, '0ms');
  const delayCss = cssValue(model.delay, raw, '0ms');

  out.push('');
  if (model.model === 'spring') out.push(`/* authored as a spring of ${model.easing}; CSS plays its easing, only a spring runtime (Motion) bounces */`);
  if (frames) out.push(...keyframesBlock(name, frames), '');
  out.push(
    ...block(`.${name}`, [
      `animation-name: ${name};`,
      `animation-duration: ${duration};`,
      `animation-timing-function: ${easing};`,
      ...delayLines(delay, delayCss, stagger),
      `animation-fill-mode: ${fill};`,
    ]),
  );

  const reducedEasing = easing;
  const reducedMs = Math.min(parseMs(literalValue(model.duration, raw, '300ms')), REDUCED_MOTION_FADE_MS);
  let reducedFrames: { at: string; decls: string[] }[] | null = null;
  if (model.model === 'tween') {
    if (kfs!.some(kf => 'opacity' in kf)) {
      // Opacity only, as the lab does: a keyframe without opacity ends fully visible.
      reducedFrames = orderedKeyframes(kfs!).map(({ offset, kf }) => ({
        at: pct(offset),
        decls: [`opacity: ${'opacity' in kf ? resolveRefs(String(kf.opacity), raw, { cssVars: true }) : '1'};`],
      }));
    }
  } else {
    const opacity = model.properties.find(p => p.property === 'opacity');
    if (opacity) {
      reducedFrames = [
        { at: 'from', decls: [`opacity: ${opacity.from};`] },
        { at: 'to', decls: [`opacity: ${opacity.to};`] },
      ];
    }
  }

  out.push('', '/* Reduced motion */', '@media (prefers-reduced-motion: reduce) {');
  if (getReducedMotionPolicy(version) === 'none' || !reducedFrames) {
    out.push(...block(`.${name}`, ['animation: none;'], '  '));
  } else {
    out.push(
      ...keyframesBlock(`${name}-reduced`, reducedFrames, '  '),
      ...block(`.${name}`, [
        `animation-name: ${name}-reduced;`,
        `animation-duration: ${Math.round(reducedMs)}ms;`,
        `animation-timing-function: ${reducedEasing};`,
      ], '  '),
    );
  }
  out.push('}');

  return out;
}

// ── Entrance presets ───────────────────────────────────────────────────────

export const PRESETS_CSS_FILE = 'presets.css';

// Shared by every component that uses a preset: one @keyframes per track and a .motion-preset-<name> class that
// runs them together. The delay (and a stagger between repeating elements) come from custom properties the
// component sets: --motion-delay, --motion-stagger and, per element, --motion-item (0, 1, 2…).
export function buildPresetsCss(raw: Record<string, unknown>, names: readonly PresetName[] = PRESET_NAMES): string {
  const out: string[] = [
    '/* Entrance presets: named, standard entrances (see the Presets view in Motion Lab). Shared by every component that uses one. */',
    '/* Add .motion-preset-<name> to the element, and set --motion-delay, --motion-stagger and --motion-item (0, 1, 2… per element) when it needs them. */',
  ];
  const v = (token: string, fallback: string): string => `var(${tokenVarName(token)}, ${fallback})`;
  const lit = (token: string): string => literalValue(token, raw, token);
  for (const name of names) {
    const tracks = presetTracks(name);
    const cls = `motion-preset-${name}`;
    const p = presetOf(name);
    const names2: string[] = [];
    const durations: string[] = [];
    const easings: string[] = [];
    out.push('');
    for (const t of tracks) {
      const kf = `${cls}-${t.track}`;
      const frames = (t.model.model === 'spring' ? [{ at: 'from', decls: ['opacity: 0;'] }, { at: 'to', decls: ['opacity: 1;'] }] : tweenFrames(t.keyframes as Keyframe[], raw));
      out.push(...keyframesBlock(kf, frames));
      names2.push(kf);
      durations.push(v(t.model.duration, lit(t.model.duration)));
      easings.push(v(t.model.easing, lit(t.model.easing)));
    }
    const fadeModel = (tracks.find(t => t.track === 'fade') ?? tracks[0]!).model;
    if (!tracks.some(t => t.track === 'fade')) out.push(...keyframesBlock(`${cls}-fade`, [{ at: 'from', decls: ['opacity: 0;'] }, { at: 'to', decls: ['opacity: 1;'] }]));
    out.push(
      ...block(`.${cls}`, [
        `animation-name: ${names2.join(', ')};`,
        `animation-duration: ${durations.join(', ')};`,
        `animation-timing-function: ${easings.join(', ')};`,
        'animation-delay: calc(var(--motion-delay, 0ms) + var(--motion-item, 0) * var(--motion-stagger, 0ms));',
        'animation-fill-mode: both;',
      ]),
      '',
      `/* ${name}: rise ${lit(p.rise)}${p.scale ? `, from scale ${lit(p.scale)}` : ''} (${p.move.duration}, ${p.move.easing})${tracks.length > 1 ? `, fade (${p.fade!.duration}, ${p.fade!.easing})` : ''} */`,
      '@media (prefers-reduced-motion: reduce) {',
      ...block(`.${cls}`, [
        `animation-name: ${cls}-fade;`,
        `animation-duration: ${Math.round(Math.min(parseMs(literalValue(fadeModel.duration, raw, '150ms')), REDUCED_MOTION_FADE_MS))}ms;`,
        `animation-timing-function: ${v(fadeModel.easing, lit(fadeModel.easing))};`,
      ], '  '),
      '}',
    );
  }
  return out.join('\n') + '\n';
}

// The presets a version uses, in the order it uses them.
export function presetsUsed(entries: StepEntry[]): PresetName[] {
  return [...new Set(entries.flatMap(e => (e.preset ? [e.preset] : [])))];
}

// A preset on an element: the component's own class sets the delay and stagger the preset reads.
function presetClassCss(entries: StepEntry[], raw: Record<string, unknown>, base: string, pageStagger: string | undefined, combined: boolean): string[] {
  const out: string[] = [];
  const seen = new Set<string | null>();
  for (const entry of entries) {
    if (!entry.preset || seen.has(entry.name)) continue;
    seen.add(entry.name);
    const cls = entry.name ? `${base}-${entry.name}` : base;
    const delay = literalValue(entry.version.model.delay, raw, '0ms');
    const hasDelay = delay !== '0ms' && delay !== '0s' && delay !== '0';
    const lines: string[] = [];
    const delayToken = entry.version.model.delay;
    const delayCss = hasDelay ? cssValue(delayToken, raw, delay) : '0ms';
    if (entry.name === null && pageStagger) lines.push('/* Stagger siblings: set --motion-index to 0, 1, 2… on each. */', `--motion-delay: calc(${delayCss} + var(--motion-index, 0) * ${pageStagger});`);
    else if (hasDelay) lines.push(`--motion-delay: ${delayCss};`);
    if (entry.elementStagger) lines.push('/* Set --motion-item to 0, 1, 2… on each repeating element. */', `--motion-stagger: ${cssValue(entry.elementStagger, raw, entry.elementStagger)};`);
    out.push('', `/* ${entry.name ? `Layer ${entry.name}` : 'The component'}: the ${entry.preset} preset. Add .motion-preset-${entry.preset}${lines.length || (combined && entry.name === null) ? ` and .${cls}` : ''} to the element${entry.name ? ` marked data-motion="${entry.name}"` : ''}. */`);
    if (lines.length) out.push(...block(`.${cls}`, lines));
    // With states after the entrance, the entrance must not hold its last frame over them.
    if (combined && entry.name === null) out.push(...block(`.motion-preset-${entry.preset}.${cls}`, ['animation-fill-mode: backwards;']));
  }
  return out;
}

// The selectors on the component's root that put it in a state because of a hover, press or focus. Hover,
// press and focus triggers are CSS pseudo-classes; a click has none, so it sets data-state (below). A trigger
// on an inner element (`target`) is `:has()` on the root.
function triggerSelectors(i: Interaction, base: string, on: 'hover' | 'press' | 'focus', state: string): string[] {
  const out: string[] = [];
  for (const t of i.triggers ?? []) {
    if (t.on !== on || t.state !== state) continue;
    const inner = t.target ? `[data-motion="${t.target}"]` : null;
    if (on === 'focus') out.push(...(inner ? [`.${base}:has(${inner}:focus-visible)`] : [`.${base}:focus-visible`, `.${base}:has(:focus-visible)`]));
    else {
      const pseudo = on === 'hover' ? ':hover' : ':active';
      out.push(inner ? `.${base}:has(${inner}${pseudo})` : `.${base}${pseudo}`);
    }
  }
  return out;
}

// An interaction version as CSS transitions between states. The rest state is the class itself; every
// other state is `[data-state="…"]` (for a click, or anything a script sets), and a hover, press or focus
// trigger is the matching pseudo-class (hover inside @media (hover: hover), so a touch screen never sticks
// on it). Each state carries the timing of going TO it (that is how a CSS transition works: it takes the
// timing of the state it arrives in). A layer (an element marked data-motion="…" inside) is a descendant rule.
function interactionCss(version: MotionVersion, raw: Record<string, unknown>, base: string): string[] {
  const i = version.interaction!;
  const names = stateNames(i);
  const parts = interactionParts(i).filter(part => partProps(i, part).length > 0);
  const partSuffix = (part: string | null): string => (part ? ` [data-motion="${part}"]` : '');
  const out: string[] = [
    `/* States: ${names.map(n => (n === i.initial ? `${n} (rest)` : n)).join(', ')}. ${i.triggers?.length ? 'Hover, press and focus are wired below; a click (or anything a script does) sets data-state="<state>" on the element.' : 'Set data-state="<state>" on the element to move between them.'} The transition into a state is the one declared on that state. */`,
  ];

  // One rule per state: the root, then each layer, under the given root selectors.
  const rules = (state: string, rootSelectors: string[], note: string, indent = ''): string[] => {
    const lines: string[] = [];
    for (const part of parts) {
      const t = timingFor(i, part, state);
      const props = partProps(i, part);
      const values = partValues(i, part, state);
      const decl: string[] = props.map(prop => {
        const v = values[prop]!;
        return `${kebab(prop)}: ${typeof v === 'string' ? resolveRefs(v, raw, { cssVars: true }) : v};`;
      });
      decl.push(
        `transition-property: ${props.map(kebab).join(', ')};`,
        `transition-duration: ${cssValue(t.duration, raw, '300ms')};`,
        `transition-timing-function: ${cssValue(t.easing, raw, 'ease')};`,
      );
      const delay = literalValue(t.delay, raw, '0ms');
      if (delay !== '0ms' && delay !== '0s' && delay !== '0') decl.push(`transition-delay: ${cssValue(t.delay, raw, delay)};`);
      const spring = t.model === 'spring' ? ': authored as a spring; CSS plays its easing, only a spring runtime (Motion) bounces' : '';
      if (lines.length) lines.push('');
      lines.push(`${indent}/* ${part ?? 'the component'}: ${note}${spring} */`, ...block(rootSelectors.map(r => r + partSuffix(part)).join(',\n' + indent), decl, indent));
    }
    return lines;
  };

  const allSelectors: string[] = [];
  for (const name of names) {
    const sel = name === i.initial ? `.${base}` : `.${base}[data-state="${name}"]`;
    allSelectors.push(...parts.map(part => sel + partSuffix(part)));
    out.push('', ...rules(name, [sel], name === i.initial ? `${name} (rest), and the transition into it` : `into ${name}`));
  }

  // Hover, press and focus triggers. Later rules win, so a press settles over a hover, as in the lab.
  for (const on of ['focus', 'hover', 'press'] as const) {
    for (const name of names) {
      const selectors = triggerSelectors(i, base, on, name);
      if (selectors.length === 0) continue;
      allSelectors.push(...selectors.flatMap(sel => parts.map(part => sel + partSuffix(part))));
      const note = `into ${name} while ${on === 'hover' ? 'hovered' : on === 'press' ? 'pressed' : 'keyboard-focused'}`;
      if (on === 'hover') out.push('', '@media (hover: hover) {', ...rules(name, selectors, note, '  '), '}');
      else out.push('', ...rules(name, selectors, note));
    }
  }

  // Reduced motion: the opacity change still fades (briefly); movement snaps.
  const policy = getReducedMotionPolicy(version);
  const fades = policy === 'fade' && parts.some(part => partProps(i, part).includes('opacity'));
  const reducedMs = Math.round(Math.min(...parts.flatMap(part => names.map(n => parseMs(literalValue(timingFor(i, part, n).duration, raw, '300ms')))), REDUCED_MOTION_FADE_MS));
  const reduced = fades ? ['transition-property: opacity;', `transition-duration: ${reducedMs}ms;`] : ['transition: none;'];
  out.push('', '/* Reduced motion */', '@media (prefers-reduced-motion: reduce) {', ...block([...new Set(allSelectors)].join(',\n  '), reduced, '  '), '}');
  return out;
}

export function buildVersionCss(
  version: MotionVersion,
  raw: Record<string, unknown>,
  options: CssOptions = {},
): string {
  const { component = 'component' } = options;
  const base = `motion-${component}-${version.id}`;
  // A stagger may be a delay token (delay.70) or a literal (80ms). It offsets the whole component,
  // layers included (a layer sits inside the element that carries --motion-index).
  const stagger = version.stagger ? cssValue(version.stagger, raw, version.stagger) : undefined;

  const out: string[] = [`/* ${component} ${version.id}: ${version.label} */`];
  const trigger = describeTrigger(version.trigger);
  const combined = version.interaction !== undefined && hasEntrance(version);
  if (combined) {
    out.push(
      trigger
        ? `/* Plays: ${trigger}. Add .${base} when the trigger fires: the entrance plays, and from then on hover, press and focus work (a hover during the entrance takes effect when it ends). */`
        : `/* Plays: trigger not specified, confirm with the designer. Add .${base} when it should play: the entrance plays, and from then on hover, press and focus work. */`,
    );
  } else if (version.interaction) out.push(`/* Add .${base} to the element once, for good: it is the resting state. */`);
  else out.push(
    trigger
      ? `/* Plays: ${trigger}. Add .${base} when the trigger fires. */`
      : `/* Plays: trigger not specified, confirm with the designer. Add .${base} when it should play. */`,
  );

  if (version.interaction && !combined) {
    out.push(...interactionCss(version, raw, base));
    return out.join('\n');
  }

  const entries = stepsOf(version);
  for (const { name, version: step, preset } of entries) {
    if (preset) continue; // a preset is the shared definition plus a class (below)
    if (name) out.push('', `/* Layer ${name}: add .${base}-${name} to the element marked data-motion="${name}" when the trigger fires. */`);
    out.push(...stepCss(step, raw, name ? `${base}-${name}` : base, stagger, combined ? 'backwards' : 'both'));
  }
  out.push(...presetClassCss(entries, raw, base, stagger, combined));
  if (options.includePresets && presetsUsed(entries).length) out.unshift(buildPresetsCss(raw, presetsUsed(entries)), `/* ── ${component} ${version.id} ── */`, '');
  if (combined) out.push('', ...interactionCss(version, raw, base));
  return out.join('\n');
}
