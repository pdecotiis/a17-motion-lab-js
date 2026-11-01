import type { MotionVersion } from './types.js';
import { playbackOf } from './motion-models.js';

// What the Motion runtime (motion.dev) is asked to play for one motion. This is only the translation
// of a version into Motion's own terms: Motion does the playing, the spring maths included.
//
// Under Motion every motion is a spring and no easing curve is used anywhere, so the runtimes stay
// easy to tell apart: CSS plays easing curves, Motion plays springs. A version authored as a spring
// uses its own bounce; a tween has none, so it plays as a spring with no bounce.

export interface MotionArgs {
  /** Per property, the values to animate through, as Motion's keyframes object (start and end). */
  keyframes: Record<string, (string | number)[]>;
  /** Seconds. */
  options: {
    type: 'spring';
    /** When the motion visually arrives: the duration token. */
    visualDuration: number;
    bounce: number;
    delay: number;
  };
  /** Why it plays the way it does, when that isn't obvious from the version. */
  note?: string;
}

// WAAPI keyframes as Motion's keyframes object. A property missing from a frame repeats its
// neighbour, so every property has one value per frame.
export function toMotionKeyframes(frames: Keyframe[]): Record<string, (string | number)[]> {
  const props = [...new Set(frames.flatMap(f => Object.keys(f)))].filter(k => !['offset', 'easing', 'composite'].includes(k));
  const keyframes: Record<string, (string | number)[]> = {};
  for (const prop of props) {
    const values: (string | number | undefined)[] = frames.map(f => (prop in f ? (f as Record<string, string | number>)[prop] : undefined));
    let last: string | number | undefined;
    for (let i = 0; i < values.length; i++) { if (values[i] === undefined) values[i] = last; else last = values[i]; }
    for (let i = values.length - 1; i >= 0; i--) { if (values[i] === undefined) values[i] = values[i + 1]; }
    keyframes[prop] = values as (string | number)[];
  }
  return keyframes;
}

// A version's motion for Motion: always a spring, from its first values to its last (a spring has no
// in-between frames). Its bounce is the version's own (a tween has none: 0); its duration is when it
// visually arrives. Reduced motion is the short opacity-only fade, as a spring with no bounce. The
// playback rate is not applied here: the caller sets Motion's `speed`.
export function motionArgsOf(
  version: MotionVersion,
  raw: Record<string, unknown>,
  options: { reducedMotion?: boolean; extraDelayMs?: number } = {},
): MotionArgs {
  const { reducedMotion = false, extraDelayMs = 0 } = options;
  const p = playbackOf(version, raw, { reducedMotion });
  const all = toMotionKeyframes(p.keyframes);
  const model = version.model;

  const skipped = p.keyframes.length > 2;
  const keyframes = Object.fromEntries(
    Object.entries(all).map(([prop, values]) => [prop, [values[0]!, values[values.length - 1]!]]),
  );

  const notes: string[] = [];
  if (model.model === 'tween') notes.push('authored as easing, so no bounce');
  if (skipped) notes.push('plays start to end, skipping the frames between');
  if (reducedMotion && model.model === 'spring') notes.push('reduced motion: opacity fade, no bounce');

  return {
    keyframes,
    options: {
      type: 'spring',
      visualDuration: (reducedMotion ? p.duration : p.pairedMs) / 1000,
      bounce: model.model === 'spring' && !reducedMotion ? model.bounce : 0,
      delay: (p.delay + extraDelayMs) / 1000,
    },
    ...(notes.length ? { note: notes.join('; ') } : {}),
  };
}

// What Motion plays, in a line: "Spring · bounce 0.5, 560ms".
export function describeMotionArgs(args: MotionArgs): string {
  const text = `Spring · bounce ${args.options.bounce}, ${Math.round(args.options.visualDuration * 1000)}ms`;
  return args.note ? `${text} (${args.note})` : text;
}
