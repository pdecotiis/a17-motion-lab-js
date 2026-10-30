// The controls panel offers the system's named options and nothing finer: the transforms for a
// tween (a duration and an easing together), the spring tokens for a spring. Picking one previews
// the version with it; nothing is saved. There are no free-form duration, easing or delay fields.

import { isTransformValue } from './token-compiler.js';
import type { LiveControls } from './types.js';

export type ControlGroup = 'transforms' | 'springs';

export interface ControlOption {
  /** Token path (e.g. "motion.transforms.entrance"); '' is "version default". */
  value: string;
  /** The token's name, e.g. "entrance". */
  label: string;
  /** What it is, e.g. "300ms · ease-out" or "bounce 0.4 · 600ms". */
  detail: string;
}

// The CSS value of a duration or cubicBezier token, e.g. "300ms" or "cubic-bezier(0, 0, 0.2, 1)".
// A literal (not a token path) is returned as is.
export function tokenCss(raw: Record<string, unknown>, path: string): string | undefined {
  const v = path in raw ? raw[path] : path;
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length === 4) return `cubic-bezier(${v.join(', ')})`;
  return undefined;
}

function tokenName(path: string): string {
  return path.slice(path.lastIndexOf('.') + 1);
}

// "300ms · ease-out" for a transform: the duration, and the easing token's name (or the literal).
function describeTransform(raw: Record<string, unknown>, path: string): string {
  const t = raw[path];
  if (!isTransformValue(t)) return '';
  const easing = t.easing in raw ? tokenName(t.easing) : t.easing;
  return `${tokenCss(raw, t.duration) ?? t.duration} · ${easing}`;
}

function describeSpring(raw: Record<string, unknown>, path: string): string {
  const s = raw[path] as { bounce?: number; duration?: number } | undefined;
  return s ? `bounce ${s.bounce ?? 0} · ${s.duration ?? 0}ms` : '';
}

// The options for a group, in token-file order.
export function controlOptions(raw: Record<string, unknown>, group: ControlGroup): ControlOption[] {
  const prefix = `motion.${group}.`;
  return Object.keys(raw)
    .filter(path => path.startsWith(prefix))
    .map(path => ({
      value: path,
      label: tokenName(path),
      detail: group === 'transforms' ? describeTransform(raw, path) : describeSpring(raw, path),
    }))
    .filter(o => o.detail !== '');
}

// What picking an option changes while previewing. '' (version default) or an unknown path → no override.
export function controlsFor(raw: Record<string, unknown>, group: ControlGroup, path: string): LiveControls {
  const v = raw[path];
  if (group === 'transforms') {
    if (!isTransformValue(v)) return {};
    const controls: LiveControls = {};
    const duration = tokenCss(raw, v.duration);
    const easing = tokenCss(raw, v.easing);
    if (duration) controls.duration = duration;
    if (easing) controls.easing = easing;
    if (v.delay) {
      const delay = tokenCss(raw, v.delay);
      if (delay) controls.delay = delay;
    }
    return controls;
  }
  if (typeof v !== 'object' || v === null) return {};
  const s = v as { bounce?: number; duration?: number };
  const controls: LiveControls = {};
  if (typeof s.duration === 'number') controls.duration = `${s.duration}ms`;
  if (typeof s.bounce === 'number') controls.bounce = s.bounce;
  return controls;
}
