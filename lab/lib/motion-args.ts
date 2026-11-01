import type { MotionVersion } from './types.js';
import { playbackOf } from './motion-models.js';

// What the Motion runtime (motion.dev) is asked to play for one motion. This is only the translation
// of a version into Motion's own terms: Motion does the playing, the spring maths included.

export type MotionEase = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | [number, number, number, number];

export interface MotionArgs {
  /** Per property, the values to animate through, as Motion's keyframes object. */
  keyframes: Record<string, (string | number)[]>;
  /** Motion's `times` (0–1), when the keyframes carry offsets. */
  times?: number[];
  /** Seconds. A spring's `visualDuration` replaces `duration`. */
  options: {
    type: 'spring' | 'tween';
    duration?: number;
    visualDuration?: number;
    bounce?: number;
    ease?: MotionEase;
    delay: number;
    times?: number[];
  };
  /** Set when the motion was authored as a spring but plays as a tween (reduced motion). */
  note?: string;
}

const NAMED: Record<string, MotionEase> = {
  linear: 'linear', 'ease-in': 'easeIn', 'ease-out': 'easeOut', 'ease-in-out': 'easeInOut',
};

// A WAAPI easing string as Motion's `ease`: a cubic-bezier as its four numbers, a keyword by name.
export function toMotionEase(easing: string): MotionEase {
  const m = /^cubic-bezier\(\s*([^)]+)\)$/.exec(easing);
  if (m) {
    const n = m[1]!.split(',').map(Number);
    if (n.length === 4 && n.every(Number.isFinite)) return n as [number, number, number, number];
  }
  if (easing in NAMED) return NAMED[easing]!;
  if (easing === 'ease') return [0.25, 0.1, 0.25, 1];
  return 'linear';
}

// WAAPI keyframes as Motion's keyframes object. A property missing from a frame repeats its
// neighbour, so every property has one value per frame.
export function toMotionKeyframes(frames: Keyframe[]): { keyframes: Record<string, (string | number)[]>; times?: number[] } {
  const props = [...new Set(frames.flatMap(f => Object.keys(f)))].filter(k => !['offset', 'easing', 'composite'].includes(k));
  const keyframes: Record<string, (string | number)[]> = {};
  for (const prop of props) {
    const values: (string | number | undefined)[] = frames.map(f => (prop in f ? (f as Record<string, string | number>)[prop] : undefined));
    let last: string | number | undefined;
    for (let i = 0; i < values.length; i++) { if (values[i] === undefined) values[i] = last; else last = values[i]; }
    for (let i = values.length - 1; i >= 0; i--) { if (values[i] === undefined) values[i] = values[i + 1]; }
    keyframes[prop] = values as (string | number)[];
  }
  const offsets = frames.map(f => f.offset);
  const times = offsets.every(o => typeof o === 'number') ? (offsets as number[]) : undefined;
  return { keyframes, ...(times ? { times } : {}) };
}

// A version's motion for Motion. A spring plays as a real spring (its bounce, its duration as the
// visual duration); a tween plays its easing curve. Reduced motion is the short opacity-only fade,
// as a tween. The playback rate is not applied here: the caller sets Motion's `speed`.
export function motionArgsOf(
  version: MotionVersion,
  raw: Record<string, unknown>,
  options: { reducedMotion?: boolean; extraDelayMs?: number } = {},
): MotionArgs {
  const { reducedMotion = false, extraDelayMs = 0 } = options;
  const p = playbackOf(version, raw, { reducedMotion });
  const { keyframes, times } = toMotionKeyframes(p.keyframes);
  const delay = (p.delay + extraDelayMs) / 1000;
  const model = version.model;

  if (model.model === 'spring' && !reducedMotion) {
    return {
      keyframes,
      options: { type: 'spring', visualDuration: p.pairedMs / 1000, bounce: model.bounce, delay },
    };
  }
  return {
    keyframes,
    options: { type: 'tween', duration: p.duration / 1000, ease: toMotionEase(p.easing), delay, ...(times ? { times } : {}) },
    ...(model.model === 'spring' ? { note: 'authored as a spring; reduced motion plays an opacity fade' } : {}),
  };
}

// What Motion plays, in a line: "Spring · bounce 0, 300ms" or "Easing · productive-entrance, 220ms".
export function describeMotionArgs(version: MotionVersion, args: MotionArgs): string {
  const name = version.model.easing.slice(version.model.easing.indexOf('.') + 1);
  const ms = Math.round((args.options.visualDuration ?? args.options.duration ?? 0) * 1000);
  const text = args.options.type === 'spring'
    ? `Spring · bounce ${args.options.bounce}, ${ms}ms`
    : `Easing · ${name}, ${ms}ms`;
  return args.note ? `${text} (${args.note})` : text;
}
