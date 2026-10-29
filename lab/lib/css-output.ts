import type { MotionVersion, TweenModel, SpringModel } from './types.js';
import { getSpringFallbackPath } from './token-refs.js';
import { springKeyframes, springToCubicBezierString, springToLinear } from './spring-engine.js';

function parseMs(value: string): number {
  if (value.endsWith('ms')) return parseFloat(value);
  if (value.endsWith('s')) return parseFloat(value) * 1000;
  return parseFloat(value);
}

function resolveStr(value: string | undefined, raw: Record<string, unknown>, fallback: string): string {
  if (!value) return fallback;
  if (value in raw) {
    const v = raw[value];
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) {
      const [x1, y1, x2, y2] = v as number[];
      return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
    }
  }
  return value;
}

function kfPropsStr(kf: Keyframe): string {
  return Object.entries(kf)
    .filter(([k]) => k !== 'offset' && k !== 'easing' && k !== 'composite')
    .map(([k, v]) => `${k}: ${v};`)
    .join('\n');
}

function springFromTo(props: SpringModel['properties']): { from: string; to: string } {
  const fromLines: string[] = [];
  const toLines: string[] = [];
  const fromTransform: string[] = [];
  const toTransform: string[] = [];
  for (const prop of props) {
    const unit = prop.unit ?? '';
    if (prop.wrapTransform) {
      fromTransform.push(`${prop.wrapTransform}(${prop.from}${unit})`);
      toTransform.push(`${prop.wrapTransform}(${prop.to}${unit})`);
    } else {
      fromLines.push(`${prop.property}: ${prop.from}${unit};`);
      toLines.push(`${prop.property}: ${prop.to}${unit};`);
    }
  }
  if (fromTransform.length) fromLines.push(`transform: ${fromTransform.join(' ')};`);
  if (toTransform.length) toLines.push(`transform: ${toTransform.join(' ')};`);
  return { from: fromLines.join('\n'), to: toLines.join('\n') };
}

function indent4(s: string): string {
  return s.split('\n').map(l => `    ${l}`).join('\n');
}

export function buildVersionCss(
  version: MotionVersion,
  raw: Record<string, unknown>,
  options: { mode?: 'css' | 'spring' } = {},
): string {
  const { mode = 'css' } = options;
  const lines: string[] = [`/* ${version.id}: ${version.label} */`];

  if (version.model.model === 'tween') {
    const model = version.model as TweenModel;
    const duration = resolveStr(model.duration, raw, '300ms');
    const easing = resolveStr(model.easing, raw, 'ease');
    const delay = resolveStr(model.delay, raw, '0ms');

    lines.push('');
    lines.push('.element {');
    lines.push(`  animation-duration: ${duration};`);
    lines.push(`  animation-timing-function: ${easing};`);
    if (delay && delay !== '0ms') lines.push(`  animation-delay: ${delay};`);
    lines.push('  animation-fill-mode: both;');
    lines.push('}');

    const kfs = version.keyframes ?? [];
    if (kfs.length >= 2) {
      lines.push('');
      lines.push('@keyframes {');
      lines.push('  from {');
      lines.push(indent4(kfPropsStr(kfs[0]!)));
      lines.push('  }');
      lines.push('  to {');
      lines.push(indent4(kfPropsStr(kfs[kfs.length - 1]!)));
      lines.push('  }');
      lines.push('}');
    }
  } else {
    const model = version.model as SpringModel;
    const tokenVal = model.duration in raw ? raw[model.duration] : null;
    let naturalDuration: number;
    if (tokenVal && typeof tokenVal === 'object' && 'duration' in tokenVal) {
      naturalDuration = (tokenVal as { duration: number }).duration;
    } else if (typeof tokenVal === 'string') {
      naturalDuration = parseMs(tokenVal);
    } else {
      naturalDuration = parseMs(model.duration);
    }

    const isToken = model.duration in raw;
    if (isToken) {
      lines.push(`/* ${model.duration}: bounce=${model.bounce}, duration=${naturalDuration}ms */`);
    }

    const fallbackPath = getSpringFallbackPath(model, raw);
    const cubicBezier = fallbackPath
      ? `cubic-bezier(${(raw[fallbackPath] as number[]).join(', ')})`
      : springToCubicBezierString(model.bounce);

    lines.push('');
    if (mode === 'spring') {
      const { duration: settleDuration } = springKeyframes({
        from: 0, to: 1, duration: naturalDuration, bounce: model.bounce, span: 1,
      });
      const linear = springToLinear(naturalDuration, model.bounce, 30);
      lines.push('.element {');
      lines.push(`  animation-duration: ${Math.round(settleDuration)}ms;`);
      lines.push(`  animation-timing-function: ${linear};`);
      lines.push('  animation-fill-mode: both;');
      lines.push('}');
      lines.push('');
      lines.push(`/* cubic-bezier fallback${fallbackPath ? ` (${fallbackPath})` : ''}: ${cubicBezier} */`);
    } else {
      lines.push('.element {');
      lines.push(`  animation-duration: ${naturalDuration}ms;`);
      lines.push(`  animation-timing-function: ${cubicBezier};`);
      lines.push('  animation-fill-mode: both;');
      lines.push('}');
    }

    const { from, to } = springFromTo(model.properties);
    lines.push('');
    lines.push('@keyframes {');
    lines.push('  from {');
    lines.push(indent4(from));
    lines.push('  }');
    lines.push('  to {');
    lines.push(indent4(to));
    lines.push('  }');
    lines.push('}');
  }

  return lines.join('\n');
}
