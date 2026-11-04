import type { MotionModel } from './types.js';

// Entrance presets: named, standard entrances, defined once, from the existing primitive tokens (no token
// type of their own). A component writes its entrance as element + preset + delay (and a stagger for
// repeating elements); the lab, the CSS, GSAP and Motion exports all read this one table.
//
// A preset is a fade plus a rise (plus a scale for card and media). The fade and the move may have their own
// timing, so a preset is up to TWO TRACKS on the same element (opacity, and transform). To use ONE track
// instead: set SEPARATE_FADE to false (every preset), or delete a preset's `fade` line (that preset only).
// With one track the fade shares the move's duration and easing.

export interface PresetTiming { duration: string; easing: string }

export interface EntrancePreset {
  /** A distance token: how far it rises from. */
  rise: string;
  /** A scale token: what it scales up from (card and media). */
  scale?: string;
  /** The rise (and scale). */
  move: PresetTiming;
  /** The opacity fade, when it has timing of its own (a second track). */
  fade?: PresetTiming;
}

/** false: every preset plays as one track, the fade sharing the move's timing. */
export const SEPARATE_FADE = true;

const FADE: PresetTiming = { duration: 'duration.300', easing: 'easing.productive-entrance' };
const MOVE: PresetTiming = { duration: 'duration.560', easing: 'easing.expressive-entrance' };

export const PRESET_NAMES = ['eyebrow', 'title', 'text', 'card', 'media', 'ui'] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

export const PRESETS: Record<PresetName, EntrancePreset> = {
  eyebrow: { rise: 'distance.16', move: MOVE, fade: FADE },
  title: { rise: 'distance.16', move: MOVE, fade: FADE },
  text: { rise: 'distance.16', move: MOVE, fade: FADE },
  card: { rise: 'distance.24', scale: 'scale.95', move: MOVE, fade: FADE },
  media: { rise: 'distance.24', scale: 'scale.98', move: MOVE, fade: FADE },
  ui: {
    rise: 'distance.8',
    move: { duration: 'duration.140', easing: 'easing.productive-standard' },
    fade: { duration: 'duration.100', easing: 'easing.productive-entrance' },
  },
};

export function isPresetName(value: unknown): value is PresetName {
  return typeof value === 'string' && (PRESET_NAMES as readonly string[]).includes(value);
}

/** A preset on an element: which one, when it starts, and (for repeating elements) the gap between them. */
export interface PresetStep {
  preset: PresetName;
  /** A delay token (or literal): when it starts. */
  delay?: string;
  /** A delay token (or literal): each matching element starts this much after the one before (title lines, grid items). */
  stagger?: string;
}

export type PresetTrackName = 'fade' | 'move' | 'all';

export interface PresetTrack {
  track: PresetTrackName;
  model: MotionModel;
  keyframes?: { [k: string]: string | number }[];
}

/** Whether a preset plays as two tracks (the fade has timing of its own) with the current setting. */
export function hasFadeTrack(preset: EntrancePreset): boolean {
  return SEPARATE_FADE && preset.fade !== undefined;
}

// The transform a preset starts from and ends at: translateY(rise) [scale(from)] → translateY(0px) [scale(1)].
function moveFrames(preset: EntrancePreset): { from: string; to: string } {
  return {
    from: `translateY({${preset.rise}})${preset.scale ? ` scale({${preset.scale}})` : ''}`,
    to: `translateY(0px)${preset.scale ? ' scale(1)' : ''}`,
  };
}

/**
 * A preset as the motions it plays. Two tracks: the fade (a spring with no bounce, so under Motion opacity
 * never overshoots; CSS plays its easing) and the move (a tween). One track: opacity and transform together
 * with the move's timing. `delay` is added to each.
 */
export function presetTracks(name: PresetName, delay?: string): PresetTrack[] {
  const p = PRESETS[name];
  const { from, to } = moveFrames(p);
  const d = delay ? { delay } : {};
  const move: PresetTrack = {
    track: hasFadeTrack(p) ? 'move' : 'all',
    model: { model: 'tween', duration: p.move.duration, easing: p.move.easing, ...d },
    keyframes: hasFadeTrack(p)
      ? [{ transform: from, offset: 0 }, { transform: to, offset: 1 }]
      : [{ opacity: 0, transform: from, offset: 0 }, { opacity: 1, transform: to, offset: 1 }],
  };
  if (!hasFadeTrack(p)) return [move];
  return [
    {
      track: 'fade',
      model: {
        model: 'spring', duration: p.fade!.duration, easing: p.fade!.easing, bounce: 'bounce.0', ...d,
        properties: [{ property: 'opacity', from: 0, to: 1 }],
      },
    },
    move,
  ];
}
