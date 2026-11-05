import type { MotionModel } from './types.js';
import presetsJson from '../../tokens/presets.json';

// Entrance presets: named, standard entrances, defined once, from the existing primitive tokens (no token
// type of their own). A component writes its entrance as element + preset + delay (and a stagger for
// repeating elements); the lab, the CSS, GSAP and Motion exports all read this one table.
//
// **The table is the project's own data**, tokens/presets.json (the template ships a default set; a project
// edits or replaces it). It names tokens only, so what a preset means follows the tokens, which follow the
// Figma Motion variable collection; the recipe itself (which tokens, for which element) is what the shared
// presets.css / presets.gsap.js / presets.motion.js carry to the team.
//
// A preset is a fade plus a rise (plus a scale for card and media). The fade and the move may have their own
// timing, so a preset is up to TWO TRACKS on the same element (opacity, and transform). To use ONE track
// instead: set `separateFade` to false in the file (every preset), or leave a preset's `fade` out (that preset
// only). With one track the fade shares the move's duration and easing.

export interface PresetTiming { duration: string; easing: string }

export type PresetStatus = 'system' | 'experimental';

export interface EntrancePreset {
  /** A distance token: how far it rises from. */
  rise: string;
  /** A scale token: what it scales up from (card and media). */
  scale?: string;
  /** The rise (and scale). */
  move: PresetTiming;
  /** The opacity fade, when it has timing of its own (a second track). */
  fade?: PresetTiming;
  /** `system` (approved) or `experimental`, like a token. A preset with no status is experimental. */
  status?: PresetStatus;
  description?: string;
}

export interface PresetTable { separateFade: boolean; presets: Record<string, EntrancePreset> }

const NAME = /^[a-z][a-z0-9-]*$/;
const TIMING_KEYS = ['duration', 'easing'];
const PRESET_KEYS = ['rise', 'scale', 'move', 'fade', 'status', 'description'];

function timing(value: unknown, where: string): PresetTiming {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${where} must be { duration, easing }`);
  const t = value as Record<string, unknown>;
  for (const k of Object.keys(t)) if (!TIMING_KEYS.includes(k)) throw new Error(`${where} has an unknown key "${k}" (use duration and easing)`);
  if (typeof t['duration'] !== 'string' || !t['duration'].startsWith('duration.')) throw new Error(`${where}.duration must be a duration token such as "duration.300"`);
  if (typeof t['easing'] !== 'string' || !t['easing'].startsWith('easing.')) throw new Error(`${where}.easing must be an easing token such as "easing.productive-entrance"`);
  return { duration: t['duration'], easing: t['easing'] };
}

/** Reads tokens/presets.json: the shape of every preset, or an error that says which one and what is wrong. */
export function parsePresets(data: unknown): PresetTable {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('presets.json must be an object');
  const root = data as Record<string, unknown>;
  for (const k of Object.keys(root)) if (k !== 'presets' && k !== 'separateFade') throw new Error(`presets.json has an unknown key "${k}"`);
  if (root['separateFade'] !== undefined && typeof root['separateFade'] !== 'boolean') throw new Error('presets.json separateFade must be true or false');
  const entries = root['presets'];
  if (typeof entries !== 'object' || entries === null || Array.isArray(entries) || Object.keys(entries).length === 0) {
    throw new Error('presets.json needs a "presets" object with at least one preset');
  }
  const presets: Record<string, EntrancePreset> = {};
  for (const [name, value] of Object.entries(entries as Record<string, unknown>)) {
    if (!NAME.test(name)) throw new Error(`Preset "${name}": a name is lowercase letters, numbers and hyphens`);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Preset "${name}" must be an object`);
    const p = value as Record<string, unknown>;
    for (const k of Object.keys(p)) if (!PRESET_KEYS.includes(k)) throw new Error(`Preset "${name}" has an unknown key "${k}"`);
    if (typeof p['rise'] !== 'string' || !p['rise'].startsWith('distance.')) throw new Error(`Preset "${name}".rise must be a distance token such as "distance.16"`);
    const out: EntrancePreset = { rise: p['rise'], move: timing(p['move'], `Preset "${name}".move`) };
    if (p['scale'] !== undefined) {
      if (typeof p['scale'] !== 'string' || !p['scale'].startsWith('scale.')) throw new Error(`Preset "${name}".scale must be a scale token such as "scale.95"`);
      out.scale = p['scale'];
    }
    if (p['fade'] !== undefined) out.fade = timing(p['fade'], `Preset "${name}".fade`);
    if (p['status'] !== undefined) {
      if (p['status'] !== 'system' && p['status'] !== 'experimental') throw new Error(`Preset "${name}".status must be "system" or "experimental"`);
      out.status = p['status'];
    }
    if (p['description'] !== undefined) {
      if (typeof p['description'] !== 'string') throw new Error(`Preset "${name}".description must be text`);
      out.description = p['description'];
    }
    presets[name] = out;
  }
  return { separateFade: root['separateFade'] !== false, presets };
}

/**
 * Problems with a preset table against the project's tokens (empty = fine): every token a preset names must
 * exist and be the right kind (a distance, a scale, a duration, an easing).
 */
export function validatePresetTokens(table: PresetTable, raw: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const check = (name: string, where: string, path: string, kind: 'distance' | 'scale' | 'duration' | 'easing'): void => {
    const v = raw[path];
    const ok = v !== undefined && (
      kind === 'easing' ? Array.isArray(v)
        : kind === 'scale' ? typeof v === 'number'
          : typeof v === 'string' && (kind === 'distance' ? v.endsWith('px') : v.endsWith('ms'))
    );
    if (v === undefined) problems.push(`Preset "${name}" ${where}: no token "${path}"`);
    else if (!ok) problems.push(`Preset "${name}" ${where}: "${path}" is not a ${kind} token`);
  };
  for (const [name, p] of Object.entries(table.presets)) {
    check(name, 'rise', p.rise, 'distance');
    if (p.scale) check(name, 'scale', p.scale, 'scale');
    check(name, 'move duration', p.move.duration, 'duration');
    check(name, 'move easing', p.move.easing, 'easing');
    if (p.fade) {
      check(name, 'fade duration', p.fade.duration, 'duration');
      check(name, 'fade easing', p.fade.easing, 'easing');
    }
  }
  return problems;
}

const table = parsePresets(presetsJson);

/** false: every preset plays as one track, the fade sharing the move's timing. */
export const SEPARATE_FADE = table.separateFade;

/** The project's preset names: whatever tokens/presets.json defines. */
export type PresetName = string;
export const PRESETS: Record<string, EntrancePreset> = table.presets;
export const PRESET_NAMES: readonly string[] = Object.keys(PRESETS);

export function isPresetName(value: unknown): value is PresetName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, value);
}

/** A preset by name; an unknown name is an error that says so. */
export function presetOf(name: string): EntrancePreset {
  const p = PRESETS[name];
  if (!p) throw new Error(`Unknown preset "${name}" (this project defines: ${PRESET_NAMES.join(', ')})`);
  return p;
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
  const p = presetOf(name);
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
