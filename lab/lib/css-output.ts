import type { MotionVersion, TweenModel, SpringModel, SpringProperty } from './types.js';
import { springKeyframes, springToLinear } from './spring-engine.js';
import { resolveRefs, tokenVarName } from './token-compiler.js';
import { springParts } from './motion-models.js';
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

function touchesTransform(props: SpringProperty[]): boolean {
  return props.some(p => p.wrapTransform !== undefined || p.property === 'transform');
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

export function buildVersionCss(
  version: MotionVersion,
  raw: Record<string, unknown>,
  options: CssOptions = {},
): string {
  const { component = 'component' } = options;
  const name = `motion-${component}-${version.id}`;
  const out: string[] = [];
  // A stagger may be a delay token (delay.70) or a literal (80ms).
  const stagger = version.stagger ? cssValue(version.stagger, raw, version.stagger) : undefined;

  out.push(`/* ${component} ${version.id}: ${version.label} (${getVersionStatus(version)}) */`);
  const trigger = describeTrigger(version.trigger);
  out.push(
    trigger
      ? `/* Plays: ${trigger}. Add .${name} when the trigger fires. */`
      : `/* Plays: trigger not specified, confirm with the designer. Add .${name} when it should play. */`,
  );

  let reducedFrames: { at: string; decls: string[] }[] | null = null;
  // Same easing the version uses (tween), or linear (spring), matching the lab's reduced-motion run.
  let reducedEasing = 'linear';
  let reducedMs = REDUCED_MOTION_FADE_MS;

  if (version.model.model === 'tween') {
    const model = version.model as TweenModel;
    const duration = cssValue(model.duration, raw, '300ms');
    const easing = cssValue(model.easing, raw, 'ease');
    const delay = literalValue(model.delay, raw, '0ms');
    const kfs = version.keyframes ?? [];

    out.push('');
    if (kfs.length >= 2) out.push(...keyframesBlock(name, tweenFrames(kfs, raw)), '');
    out.push(
      ...block(`.${name}`, [
        `animation-name: ${name};`,
        `animation-duration: ${duration};`,
        `animation-timing-function: ${easing};`,
        ...delayLines(delay, stagger),
        'animation-fill-mode: both;',
      ]),
    );

    reducedEasing = easing;
    reducedMs = Math.min(parseMs(literalValue(model.duration, raw, '300ms')), REDUCED_MOTION_FADE_MS);
    if (kfs.some(kf => 'opacity' in kf)) {
      // Opacity only, as the lab does: a keyframe without opacity ends fully visible.
      reducedFrames = orderedKeyframes(kfs).map(({ offset, kf }) => ({
        at: pct(offset),
        decls: [`opacity: ${'opacity' in kf ? resolveRefs(String(kf.opacity), raw, { cssVars: true }) : '1'};`],
      }));
    }
  } else {
    const model = version.model as SpringModel;
    const { bounce, durationMs, pairedMs } = springParts(model, raw);
    const delay = literalValue(model.delay, raw, '0ms');

    out.push(`/* spring of ${model.easing}: bounce ${bounce}, ${Math.round(durationMs)}ms (${pairedMs}ms / 0.82) */`);

    // The spring is a linear() curve, which eases a whole animation, not each property. Properties
    // that follow the spring and properties that fade linearly (useSpring: false) therefore become
    // two animations, unless both want `transform` (they would overwrite each other).
    const springProps = model.properties.filter(p => p.useSpring !== false);
    const linearProps = model.properties.filter(p => p.useSpring === false);
    const split = springProps.length > 0 && linearProps.length > 0
      && !(touchesTransform(springProps) && touchesTransform(linearProps));

    out.push('');
    if (springProps.length > 0 && linearProps.length > 0 && !split) {
      out.push('/* Note: both spring and linear parts animate transform, so they share the spring curve here. */');
    }

    const groups = split
      ? [{ name, props: springProps, easing: 'spring' as const }, { name: `${name}-linear`, props: linearProps, easing: 'linear' as const }]
      : [{ name, props: model.properties, easing: springProps.length === 0 ? 'linear' as const : 'spring' as const }];
    for (const g of groups) out.push(...keyframesBlock(g.name, springFrames(g.props)), '');

    // The spring runs until it settles, which can be longer than its nominal duration.
    const hasSpring = groups.some(g => g.easing === 'spring');
    const { duration: settleDuration } = springKeyframes({ from: 0, to: 1, duration: durationMs, bounce, span: 1 });
    const ms = Math.round(hasSpring ? settleDuration : durationMs);
    const linear = springToLinear(durationMs, bounce, 30);

    out.push(
      ...block(`.${name}`, [
        `animation-name: ${groups.map(g => g.name).join(', ')};`,
        `animation-duration: ${groups.map(() => `${ms}ms`).join(', ')};`,
        `animation-timing-function: ${groups.map(g => (g.easing === 'linear' ? 'linear' : linear)).join(', ')};`,
        ...delayLines(delay, stagger),
        'animation-fill-mode: both;',
      ]),
    );

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

  return out.join('\n');
}
