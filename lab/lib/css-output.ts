import type { MotionVersion, EntranceVersion, SpringProperty } from './types.js';
import { resolveRefs, tokenVarName } from './token-compiler.js';
import { stepsOf } from './motion-models.js';
import { stateNames, stateProps } from './interaction.js';
import { REDUCED_MOTION_FADE_MS } from './reduced-motion.js';
import { describeTrigger, getReducedMotionPolicy, getVersionStatus } from './version-meta.js';

// Stack-neutral CSS for a version: named @keyframes, a class that applies them, token custom
// properties (with the literal value as fallback, so the file works without tokens.css),
// and a prefers-reduced-motion block. Plain CSS, so it ports to any stack; a developer on GSAP
// or Motion reads the same numbers from it.

export interface CssOptions {
  // Used in the class and @keyframes names: .motion-<component>-<version>.
  component?: string;
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
// an index the developer sets on each sibling (--motion-index: 0, 1, 2, …).
function delayLines(delay: string, stagger: string | undefined): string[] {
  const hasDelay = delay !== '0ms' && delay !== '0s' && delay !== '0';
  if (stagger) {
    const base = hasDelay ? `${delay} + ` : '';
    return [
      '/* Stagger: set --motion-index to 0, 1, 2… on each sibling. */',
      `animation-delay: calc(${base}var(--motion-index, 0) * ${stagger});`,
    ];
  }
  return hasDelay ? [`animation-delay: ${delay};`] : [];
}

function block(selector: string, lines: string[], indent = ''): string[] {
  return [`${indent}${selector} {`, ...lines.map(l => `${indent}  ${l}`), `${indent}}`];
}

// One motion (the root's or a layer's) as @keyframes, a class and its reduced-motion block.
function stepCss(version: EntranceVersion, raw: Record<string, unknown>, name: string, stagger: string | undefined): string[] {
  const out: string[] = [];

  // A spring version has no real spring in CSS: it plays its from/to values with the easing curve.
  const model = version.model;
  const kfs = model.model === 'tween' ? (version.keyframes ?? []) : null;
  const frames = model.model === 'spring' ? springFrames(model.properties) : kfs!.length >= 2 ? tweenFrames(kfs!, raw) : null;
  const duration = cssValue(model.duration, raw, '300ms');
  const easing = cssValue(model.easing, raw, 'ease');
  const delay = literalValue(model.delay, raw, '0ms');

  out.push('');
  if (model.model === 'spring') out.push(`/* authored as a spring of ${model.easing}; CSS plays its easing, only a spring runtime (Motion) bounces */`);
  if (frames) out.push(...keyframesBlock(name, frames), '');
  out.push(
    ...block(`.${name}`, [
      `animation-name: ${name};`,
      `animation-duration: ${duration};`,
      `animation-timing-function: ${easing};`,
      ...delayLines(delay, stagger),
      'animation-fill-mode: both;',
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

// An interaction version as CSS transitions between states. The rest state is the class itself; every
// other state is `[data-state="…"]`, and each carries the timing of going TO it (that is how a CSS
// transition works: it takes the timing of the state it arrives in).
function interactionCss(version: MotionVersion, raw: Record<string, unknown>, base: string): string[] {
  const i = version.interaction!;
  const props = stateProps(i);
  const names = stateNames(i);
  const out: string[] = [
    `/* States: ${names.map(n => (n === i.initial ? `${n} (rest)` : n)).join(', ')}. Set data-state="<state>" on the element to move between them; the transition into a state is the one declared on that state. */`,
  ];
  for (const name of names) {
    const t = i.transitions[name]!;
    const selector = name === i.initial ? `.${base}` : `.${base}[data-state="${name}"]`;
    const values = i.states[name]!;
    const lines: string[] = [];
    for (const prop of props) {
      if (!(prop in values)) continue;
      const v = values[prop]!;
      lines.push(`${kebab(prop)}: ${typeof v === 'string' ? resolveRefs(v, raw, { cssVars: true }) : v};`);
    }
    lines.push(
      `transition-property: ${props.map(kebab).join(', ')};`,
      `transition-duration: ${cssValue(t.duration, raw, '300ms')};`,
      `transition-timing-function: ${cssValue(t.easing, raw, 'ease')};`,
    );
    const delay = literalValue(t.delay, raw, '0ms');
    if (delay !== '0ms' && delay !== '0s' && delay !== '0') lines.push(`transition-delay: ${delay};`);
    out.push('', `/* ${name === i.initial ? `${name} (rest), and the transition into it` : `into ${name}`}${t.model === 'spring' ? `: authored as a spring; CSS plays its easing, only a spring runtime (Motion) bounces` : ''} */`, ...block(selector, lines));
  }
  // Reduced motion: the opacity change still fades (briefly); movement snaps.
  const policy = getReducedMotionPolicy(version);
  const selectors = names.map(n => (n === i.initial ? `.${base}` : `.${base}[data-state="${n}"]`));
  const fades = policy === 'fade' && props.includes('opacity');
  const reduced = fades
    ? ['transition-property: opacity;', `transition-duration: ${Math.round(Math.min(...names.map(n => parseMs(literalValue(i.transitions[n]!.duration, raw, '300ms'))), REDUCED_MOTION_FADE_MS))}ms;`]
    : ['transition: none;'];
  out.push('', '/* Reduced motion */', '@media (prefers-reduced-motion: reduce) {', ...block(selectors.join(',\n  '), reduced, '  '), '}');
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

  const out: string[] = [`/* ${component} ${version.id}: ${version.label} (${getVersionStatus(version)}) */`];
  const trigger = describeTrigger(version.trigger);
  out.push(
    trigger
      ? `/* Plays: ${trigger}. Add .${base} when the trigger fires. */`
      : `/* Plays: trigger not specified, confirm with the designer. Add .${base} when it should play. */`,
  );

  if (version.interaction) {
    out.push(...interactionCss(version, raw, base));
    return out.join('\n');
  }

  for (const { name, version: step } of stepsOf(version)) {
    if (name) out.push('', `/* Layer ${name}: add .${base}-${name} to the element marked data-motion="${name}" when the trigger fires. */`);
    out.push(...stepCss(step, raw, name ? `${base}-${name}` : base, stagger));
  }
  return out.join('\n');
}
