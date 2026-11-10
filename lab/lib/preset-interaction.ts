import type { Interaction, MotionVersion, TransitionTiming } from './types.js';
import { presetOf } from './entrance-presets.js';

// A preset's hover and press as an ordinary interaction (states default / hovered / pressed on the element itself, triggers hover and press),
// so the lab's player, the CSS and the code exports all play and write it the way they do any states. A version names the elements
// that use a preset in `elements` ({ 'search': 'button' }); nothing about the states is written in the version.

const tween = (t: { duration: string; easing: string }): TransitionTiming => ({ model: 'tween', duration: t.duration, easing: t.easing });

/** The properties an element preset moves: a tint (a slight darkening) and a scale. */
export const PRESET_INTERACTION_PROPS = ['filter', 'transform'] as const;

/** Whether a preset has hover and/or press. */
export function hasPresetInteraction(name: string): boolean {
  return presetOf(name).interaction !== undefined;
}

const shade = (tint: number): string => `brightness(${Math.round((1 - tint) * 1000) / 1000})`;

/**
 * The preset's interaction. One element has one timing per state, so: going to pressed uses the press timing, going to hovered uses the
 * release timing (so letting go while still over it plays the release), and going back to default uses the hover timing (the tint fades
 * out as it came in). A preset with no hover has no hovered state; one with no press has no pressed state.
 */
export function interactionOfPreset(name: string): Interaction {
  const ix = presetOf(name).interaction;
  if (!ix) throw new Error(`Preset "${name}" has no interaction (add "interaction": { "hover": …, "press": … } to tokens/presets.json)`);
  const scales = !!ix.press;
  const base = { filter: 'brightness(1)', ...(scales ? { transform: 'scale(1)' } : {}) };
  const states: Interaction['states'] = { default: base };
  const transitions: Interaction['transitions'] = { default: tween(ix.hover?.timing ?? ix.press!.release) };
  const triggers: NonNullable<Interaction['triggers']> = [];
  if (ix.hover) {
    states['hovered'] = { filter: shade(ix.hover.tint), ...(scales ? { transform: 'scale(1)' } : {}) };
    transitions['hovered'] = tween(ix.press?.release ?? ix.hover.timing);
    triggers.push({ on: 'hover', state: 'hovered' });
  }
  if (ix.press) {
    states['pressed'] = { filter: shade(ix.press.tint), transform: `scale({${ix.press.scale}})` };
    transitions['pressed'] = tween(ix.press.timing);
    triggers.push({ on: 'press', state: 'pressed' });
  }
  return { initial: 'default', states, transitions, triggers };
}

/** A version whose interaction is the preset's: what an element that uses the preset plays (the player takes the element as its root). */
export function versionForElementPreset(version: MotionVersion, name: string): MotionVersion {
  return { id: version.id, label: version.label, model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-standard' }, keyframes: [], interaction: interactionOfPreset(name), lineage: 'preset' };
}
