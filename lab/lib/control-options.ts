// The controls panel offers the system's durations and easings and nothing finer: pick a duration
// token, pick an easing token. A version previews with the pick; nothing is saved. There are no
// free-form values and no delay control.

import { isSpringForm, springKey } from './token-compiler.js';
import type { LiveControls } from './types.js';

/** What a version plays: a tween plays its easing curve, a spring its easing's spring form. */
export type PlayKind = 'tween' | 'spring';

export interface ControlOption {
  /** Token path (e.g. "duration.300"); '' is "version default". */
  value: string;
  /** What to show: "300ms" for a duration, "productive-standard" for an easing. */
  label: string;
}

// The CSS value of a duration or easing token, e.g. "300ms" or "cubic-bezier(0.2, 0, 0.38, 0.9)".
// A literal (not a token path) is returned as is.
export function tokenCss(raw: Record<string, unknown>, path: string): string | undefined {
  const v = path in raw ? raw[path] : path;
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length === 4) return `cubic-bezier(${v.join(', ')})`;
  return undefined;
}

// A token's name within its group: "easing.productive-standard" → "productive-standard",
// "duration.300" → "300".
export function tokenLabel(path: string): string {
  return path.slice(path.indexOf('.') + 1);
}

// The tokens a version can be previewed with, in token-file order. A spring can only use an easing
// that has a spring form (exits and linear have none).
export function controlOptions(raw: Record<string, unknown>, group: 'duration' | 'easing', kind: PlayKind): ControlOption[] {
  return Object.keys(raw)
    .filter(path => path.startsWith(`${group}.`) && !path.endsWith('.spring'))
    .filter(path => group === 'duration' || kind === 'tween' || isSpringForm(raw[springKey(path)]))
    .map(path => ({ value: path, label: group === 'duration' ? (tokenCss(raw, path) ?? path) : tokenLabel(path) }));
}

// What the picks change while previewing. '' (version default) or an unknown path changes nothing.
// A tween previews the easing curve; a spring takes the bounce of the easing's spring form (its
// own duration is derived from the duration pick when it plays).
export function controlsFor(
  raw: Record<string, unknown>,
  kind: PlayKind,
  picks: { duration?: string; easing?: string },
): LiveControls {
  const controls: LiveControls = {};
  const duration = picks.duration && picks.duration in raw ? tokenCss(raw, picks.duration) : undefined;
  if (duration) controls.duration = duration;
  if (picks.easing && picks.easing in raw) {
    if (kind === 'spring') {
      const form = raw[springKey(picks.easing)];
      if (isSpringForm(form)) controls.bounce = form.bounce;
    } else {
      const easing = tokenCss(raw, picks.easing);
      if (easing) controls.easing = easing;
    }
  }
  return controls;
}
