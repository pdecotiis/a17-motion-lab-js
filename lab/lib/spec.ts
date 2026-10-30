import type { MotionVersion, TweenModel, SpringModel } from './types.js';
import { tokenVarName, type CompiledTokens } from './token-compiler.js';
import { buildVersionCss, orderedKeyframes } from './css-output.js';
import { getTokenRefs } from './token-refs.js';
import { springKeyframes } from './spring-engine.js';
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

// "motion.timings.base (300ms)" for a token, or the literal when the value isn't one.
function describeValue(value: string | undefined, raw: Record<string, unknown>, fallback: string): string {
  if (!value) return fallback;
  return value in raw ? `${value} (${literal(raw[value])})` : `${value} (hard-coded, not a token)`;
}

function springTokenLine(model: SpringModel, raw: Record<string, unknown>): { token: string; duration: number } {
  const v = raw[model.duration];
  if (v && typeof v === 'object' && 'duration' in v) {
    return { token: `${model.duration} (bounce ${model.bounce}, ${(v as { duration: number }).duration}ms)`, duration: (v as { duration: number }).duration };
  }
  const ms = parseMs(model.duration);
  return { token: `${model.duration} (hard-coded, bounce ${model.bounce})`, duration: ms };
}

function motionLines(version: MotionVersion, raw: Record<string, unknown>): string[] {
  if (version.model.model === 'tween') {
    const m = version.model as TweenModel;
    const lines = [
      `- Duration: ${describeValue(m.duration, raw, '300ms')}`,
      `- Easing: ${describeValue(m.easing, raw, 'ease')}`,
      `- Delay: ${m.delay ? describeValue(m.delay, raw, '0ms') : '0ms'}`,
    ];
    if (version.stagger) lines.push(`- Stagger: ${version.stagger} between siblings`);
    return lines;
  }
  const m = version.model as SpringModel;
  const { token, duration } = springTokenLine(m, raw);
  const { duration: settle } = springKeyframes({ from: 0, to: 1, duration, bounce: m.bounce, span: 1 });
  const lines = [
    `- Spring: ${token}`,
    `- Settles in about ${Math.round(settle)}ms (real spring, shipped as a CSS linear() curve)`,
    `- Fallback for browsers without linear(): a cubic-bezier over ${duration}ms (an approximation of the spring)`,
    `- Delay: ${m.delay ? describeValue(m.delay, raw, '0ms') : '0ms'}`,
  ];
  if (version.stagger) lines.push(`- Stagger: ${version.stagger} between siblings`);
  return lines;
}

function animatedLines(version: MotionVersion): string[] {
  if (version.model.model === 'tween') {
    return orderedKeyframes(version.keyframes ?? []).map(({ offset, kf }) => {
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
    return `- ${p.property}: ${wrap(p.from)} → ${wrap(p.to)} (${p.useSpring === false ? 'linear' : 'spring'})`;
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
  const css = buildVersionCss(version, raw, { mode: 'spring', component });

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
    ...animatedLines(version),
    '',
    '## Timing',
    '',
    ...motionLines(version, raw),
    '',
    '## Reduced motion',
    '',
    ...reducedMotionLines(version),
    '',
    '## Using it',
    '',
    '1. Load `tokens.css` (or any stylesheet that defines the same custom properties) and `motion.css`.',
    `2. Add the class \`.${name}\` to the animated element when the trigger fires.`,
    ...(version.stagger ? ['3. Set `--motion-index: 0, 1, 2…` on each sibling to stagger them.'] : []),
    '',
    'The CSS is plain and stack-neutral. On GSAP, Motion or another library, take the numbers from this file instead.',
    '',
    '## Tokens',
    '',
    ...(used.length ? used.map(t => `- \`${t}\``) : ['- None']),
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

function cssVarFor(path: string, cssVars: Record<string, string>): string | null {
  const key = tokenVarName(path);
  return key in cssVars ? `${key}: ${cssVars[key]}` : null;
}
