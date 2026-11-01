import type { MotionVersion, TweenModel, SpringModel } from './types.js';
import { tokenVarName, type CompiledTokens } from './token-compiler.js';
import { buildVersionCss, orderedKeyframes } from './css-output.js';
import { getStepRefs, getTokenRefs } from './token-refs.js';
import { resolveKeyframes, stepsOf } from './motion-models.js';
import { REDUCED_MOTION_FADE_MS } from './reduced-motion.js';
import {
  STATUS_LABELS, describeLineage, describeTrigger, getReducedMotionPolicy, getVersionStatus,
  REDUCED_MOTION_LABELS,
} from './version-meta.js';

// The hand-off for one version: stack-neutral CSS, the tokens it uses, and a spec.md that
// says everything the CSS can't (when it plays, reduced motion, what the lab doesn't cover).

export interface VersionExport {
  css: string;
  tokensCss: string;
  markdown: string;
}

function parseMs(value: string): number {
  if (value.endsWith('ms')) return parseFloat(value);
  if (value.endsWith('s')) return parseFloat(value) * 1000;
  return parseFloat(value);
}

function literal(value: unknown): string {
  if (Array.isArray(value)) return `cubic-bezier(${(value as number[]).join(', ')})`;
  return String(value);
}

// "duration.base (300ms)" for a token, or the literal when the value isn't one.
function describeValue(value: string | undefined, raw: Record<string, unknown>, fallback: string): string {
  if (!value) return fallback;
  return value in raw ? `${value} (${literal(raw[value])})` : `${value} (hard-coded, not a token)`;
}

// "delay.70 (70ms)" for a token, the literal as it is otherwise.
function stagger(value: string, raw: Record<string, unknown>): string {
  return value in raw ? `${value} (${literal(raw[value])})` : value;
}

function motionLines(version: MotionVersion, raw: Record<string, unknown>): string[] {
  const m = version.model;
  const lines = [
    `- Duration: ${describeValue(m.duration, raw, '300ms')}`,
    `- Easing: ${describeValue(m.easing, raw, 'ease')}`,
  ];
  if (m.model === 'spring') {
    lines.push('- Authored as a spring: CSS plays its easing curve over the duration; only a spring runtime (Motion) bounces');
  }
  lines.push(`- Delay: ${m.delay ? describeValue(m.delay, raw, '0ms') : '0ms'}`);
  if (version.stagger) lines.push(`- Stagger: ${stagger(version.stagger, raw)} between siblings`);
  return lines;
}

function animatedLines(version: MotionVersion, raw: Record<string, unknown>): string[] {
  if (version.model.model === 'tween') {
    return orderedKeyframes(resolveKeyframes(version.keyframes, raw)).map(({ offset, kf }) => {
      const props = Object.entries(kf)
        .filter(([k]) => k !== 'offset' && k !== 'easing' && k !== 'composite')
        .map(([k, v]) => `${k} ${String(v)}`);
      return `- ${Math.round(offset * 1000) / 10}%: ${props.join(', ')}`;
    });
  }
  const m = version.model as SpringModel;
  return m.properties.map(p => {
    const unit = p.unit ?? '';
    const wrap = (n: number): string => (p.wrapTransform ? `${p.wrapTransform}(${n}${unit})` : `${n}${unit}`);
    return `- ${p.property}: ${wrap(p.from)} → ${wrap(p.to)}`;
  });
}

function reducedMotionLines(version: MotionVersion): string[] {
  const policy = getReducedMotionPolicy(version);
  const lines = [`- ${REDUCED_MOTION_LABELS[policy]}.`];
  if (policy === 'fade') {
    lines.push(`- Movement and scale are dropped; only the opacity change plays, for at most ${REDUCED_MOTION_FADE_MS}ms.`);
  } else {
    lines.push('- The element appears in its end state.');
  }
  lines.push('- Already written into motion.css inside `@media (prefers-reduced-motion: reduce)`. A JS-driven version must honour the same rule.');
  return lines;
}

export function buildVersionExport(
  component: string,
  version: MotionVersion,
  siblings: MotionVersion[],
  tokens: CompiledTokens,
): VersionExport {
  const { raw, cssVars } = tokens;
  const name = `motion-${component}-${version.id}`;
  const css = buildVersionCss(version, raw, { component });
  const layers = stepsOf(version).filter(s => s.name !== null);

  const used = getTokenRefs(version, raw).tokens;
  const varLines = used.filter(t => cssVarFor(t, cssVars)).map(t => `  ${cssVarFor(t, cssVars)};`);
  const tokensCss = varLines.length ? `:root {\n${varLines.join('\n')}\n}\n` : '/* This version uses no CSS-variable tokens. */\n';

  const trigger = describeTrigger(version.trigger);
  const status = getVersionStatus(version);
  const md: string[] = [
    `# ${component} ${version.id}: ${version.label}`,
    '',
    `Status: ${STATUS_LABELS[status]}${status === 'approved' ? '' : ' (not approved yet, expect changes)'}`,
    `Lineage: ${describeLineage(version, siblings)}`,
    'Source: Motion Lab. The values below come from the version file; motion.css is generated from the same data.',
    '',
    '## When it plays',
    '',
    trigger ?? '**Not specified.** The designer has not said what triggers this. Ask before wiring it up.',
    '',
    '## What animates',
    '',
    ...(layers.length ? ['The component\'s root element (the one marked `data-motion-target`):', ''] : []),
    ...animatedLines(version, raw),
    '',
    '## Timing',
    '',
    ...motionLines(version, raw),
    '',
    // Each layer is a motion of its own: it names its own duration, easing and delay.
    ...layers.flatMap(({ name: layer, version: step }) => [
      `## Layer: ${layer}`,
      '',
      `Add \`.${name}-${layer}\` to the element marked \`data-motion="${layer}"\`.`,
      '',
      '### What animates',
      '',
      ...animatedLines(step, raw),
      '',
      '### Timing',
      '',
      ...motionLines({ ...step, stagger: undefined }, raw),
      '',
    ]),
    '## Reduced motion',
    '',
    ...reducedMotionLines(version),
    '',
    '## Using it',
    '',
    '1. Load `tokens.css` (or any stylesheet that defines the same custom properties) and `motion.css`.',
    `2. Add the class \`.${name}\` to the animated element when the trigger fires${layers.length ? ', and each layer\'s class (above) to its element' : ''}.`,
    ...(version.stagger ? [`3. Set \`--motion-index: 0, 1, 2…\` on each sibling to stagger them.`] : []),
    '',
    'The CSS is plain and stack-neutral. On GSAP, Motion or another library, take the numbers from this file instead.',
    '',
    '## Tokens',
    '',
    ...tokenLines(version, raw),
    '',
    '## Not covered by this spec',
    '',
    '- **The element.** In the lab the motion runs on the element marked `data-motion-target` in the imported markup, which is a rebuild of the Figma frame, not your production DOM. Point the class at the real element.',
    '- **Layout and environment.** Real content, breakpoints, `overflow` clipping, stacking contexts and transform origin can change how the same keyframes look.',
    '- **Performance.** Not measured on a real page.',
    '',
  ];

  return { css: `${css}\n`, tokensCss, markdown: md.join('\n') };
}

// The tokens used and where: one flat list for a single motion, grouped by motion when there are layers.
function tokenLines(version: MotionVersion, raw: Record<string, unknown>): string[] {
  const steps = getStepRefs(version, raw);
  const line = (u: { token: string; where: string[] }, pad = ''): string => `${pad}- \`${u.token}\` (${u.where.join(', ')})`;
  if (steps.length === 1) return steps[0]!.uses.length ? steps[0]!.uses.map(u => line(u)) : ['- None'];
  return steps.flatMap(s => [`- **${s.layer ?? 'root'}**`, ...(s.uses.length ? s.uses.map(u => line(u, '  ')) : ['  - None'])]);
}

function cssVarFor(path: string, cssVars: Record<string, string>): string | null {
  const key = tokenVarName(path);
  return key in cssVars ? `${key}: ${cssVars[key]}` : null;
}
