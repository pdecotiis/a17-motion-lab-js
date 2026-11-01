import type { MotionVersion } from './types.js';
import { playbackOf, resolveBounce } from './motion-models.js';

// The global bounce setting a motion uses when it names none: Motion's own default.
export const DEFAULT_BOUNCE = 'bounce.25';

// What the Motion runtime (motion.dev) is asked to play for one motion. This is only the translation
// of a version into Motion's own terms: Motion does the playing, the spring maths included.
//
// Under Motion every motion is a spring and no easing curve is used anywhere, so the runtimes stay
// easy to tell apart: CSS plays easing curves, Motion plays springs. A spring version may name its own
// bounce; every other motion (tweens, layers) uses the global bounce setting.

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
  /** The bounce token it uses: the version's own, or the global setting. Absent for a literal number. */
  bounceToken?: string;
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
// in-between frames). Its bounce is the version's own when it names one, else the global setting
// (`globalBounce`, a bounce token); its duration is when it visually arrives. Reduced motion is the
// short opacity-only fade, as a spring with no bounce. The playback rate is not applied here: the
// caller sets Motion's `speed`.
export function motionArgsOf(
  version: MotionVersion,
  raw: Record<string, unknown>,
  options: { reducedMotion?: boolean; extraDelayMs?: number; globalBounce?: string } = {},
): MotionArgs {
  const { reducedMotion = false, extraDelayMs = 0, globalBounce = DEFAULT_BOUNCE } = options;
  const p = playbackOf(version, raw, { reducedMotion });
  const all = toMotionKeyframes(p.keyframes);
  const model = version.model;

  const skipped = p.keyframes.length > 2;
  const keyframes = Object.fromEntries(
    Object.entries(all).map(([prop, values]) => [prop, [values[0]!, values[values.length - 1]!]]),
  );

  const own = model.model === 'spring' ? model.bounce : undefined;
  const bounceToken = typeof own === 'number' ? undefined : (own ?? globalBounce);
  const bounce = reducedMotion ? 0 : resolveBounce(own ?? globalBounce, raw);

  const notes: string[] = [];
  if (own === undefined && !reducedMotion) notes.push(model.model === 'tween' ? 'authored as easing; bounce is the global setting' : 'bounce is the global setting');
  if (skipped) notes.push('plays start to end, skipping the frames between');
  if (reducedMotion && model.model === 'spring') notes.push('reduced motion: opacity fade, no bounce');

  return {
    keyframes,
    options: {
      type: 'spring',
      visualDuration: (reducedMotion ? p.duration : p.pairedMs) / 1000,
      bounce,
      delay: (p.delay + extraDelayMs) / 1000,
    },
    ...(bounceToken && !reducedMotion ? { bounceToken } : {}),
    ...(notes.length ? { note: notes.join('; ') } : {}),
  };
}

// What Motion plays, in a line: "Spring · bounce 0.5 (bounce.50), 560ms".
export function describeMotionArgs(args: MotionArgs): string {
  const token = args.bounceToken ? ` (${args.bounceToken})` : '';
  const text = `Spring · bounce ${args.options.bounce}${token}, ${Math.round(args.options.visualDuration * 1000)}ms`;
  return args.note ? `${text} (${args.note})` : text;
}
