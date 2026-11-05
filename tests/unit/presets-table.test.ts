import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PRESETS, PRESET_NAMES, isPresetName, parsePresets, presetOf, presetTracks, validatePresetTokens,
} from '../../lab/lib/entrance-presets.js';
import { pairingWarnings } from '../../lab/lib/token-refs.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import { SAMPLES_PRESENT, TEMPLATE_DEFAULT_PRESETS } from '../samples.js';
import type { DtcgGroup, MotionVersion } from '../../lab/lib/types.js';

// The preset table is the project's own data (tokens/presets.json). These hold for whatever a project puts in it.
// The tests that pin the template's default presets are in entrance-presets.test.ts and skip when it is edited.

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

const ok = {
  eyebrow: {
    rise: 'distance.16',
    move: { duration: 'duration.560', easing: 'easing.expressive-entrance' },
    fade: { duration: 'duration.300', easing: 'easing.productive-entrance' },
  },
};

describe('tokens/presets.json in this repo', () => {
  it('defines at least one preset, and the lab loaded it', () => {
    expect(PRESET_NAMES.length).toBeGreaterThan(0);
    expect(Object.keys(PRESETS)).toEqual([...PRESET_NAMES]);
  });

  it('is valid: shaped right, and every token it names exists and is the right kind', () => {
    const file = JSON.parse(readFileSync(join(process.cwd(), 'tokens/presets.json'), 'utf8')) as unknown;
    const table = parsePresets(file);
    expect(validatePresetTokens(table, raw)).toEqual([]);
  });

  it('every preset follows the pairing rules (productive easings with 100–300ms, expressive with 400–1200ms)', () => {
    for (const name of PRESET_NAMES) {
      const v: MotionVersion = { id: 'v1', label: name, entrance: { preset: name }, lineage: 'test' };
      expect(pairingWarnings(v, raw), name).toEqual([]);
    }
  });

  it('every preset builds its tracks, and an unknown name is refused with the names the project has', () => {
    for (const name of PRESET_NAMES) expect(presetTracks(name).length, name).toBeGreaterThan(0);
    expect(isPresetName(PRESET_NAMES[0])).toBe(true);
    expect(isPresetName('nope')).toBe(false);
    expect(isPresetName('toString')).toBe(false);
    expect(() => presetOf('nope')).toThrow(`this project defines: ${PRESET_NAMES.join(', ')}`);
  });

  it('is the template\'s default in the template itself (tests/samples.ts keeps a copy for the tests that pin it)', () => {
    if (!SAMPLES_PRESENT) return; // a project is free to change it
    const file = JSON.parse(readFileSync(join(process.cwd(), 'tokens/presets.json'), 'utf8')) as unknown;
    expect(file).toEqual(TEMPLATE_DEFAULT_PRESETS);
  });
});

describe('parsePresets', () => {
  it('reads presets, defaulting separateFade to true and leaving the optional fields out', () => {
    const t = parsePresets({ presets: ok });
    expect(t.separateFade).toBe(true);
    expect(t.presets['eyebrow']).toEqual(ok.eyebrow);
  });

  it('keeps scale, status and description when given', () => {
    const t = parsePresets({ separateFade: false, presets: { card: { ...ok.eyebrow, scale: 'scale.95', status: 'system', description: 'A card' } } });
    expect(t.separateFade).toBe(false);
    expect(t.presets['card']).toMatchObject({ scale: 'scale.95', status: 'system', description: 'A card' });
  });

  it('refuses what is not an object, an empty table and unknown top-level keys', () => {
    expect(() => parsePresets('x')).toThrow('must be an object');
    expect(() => parsePresets({ presets: {} })).toThrow('at least one preset');
    expect(() => parsePresets({ presets: ok, extra: 1 })).toThrow('unknown key "extra"');
    expect(() => parsePresets({ presets: ok, separateFade: 'yes' })).toThrow('separateFade');
  });

  it('says which preset and what is wrong', () => {
    expect(() => parsePresets({ presets: { 'Big Title': ok.eyebrow } })).toThrow('lowercase letters');
    expect(() => parsePresets({ presets: { x: { ...ok.eyebrow, rise: '16px' } } })).toThrow('Preset "x".rise must be a distance token');
    expect(() => parsePresets({ presets: { x: { ...ok.eyebrow, scale: 'distance.4' } } })).toThrow('Preset "x".scale must be a scale token');
    expect(() => parsePresets({ presets: { x: { ...ok.eyebrow, move: { duration: '300ms', easing: 'easing.linear' } } } })).toThrow('Preset "x".move.duration');
    expect(() => parsePresets({ presets: { x: { ...ok.eyebrow, fade: { duration: 'duration.300', easing: 'ease' } } } })).toThrow('Preset "x".fade.easing');
    expect(() => parsePresets({ presets: { x: { ...ok.eyebrow, move: { duration: 'duration.300', easing: 'easing.linear', delay: 'delay.40' } } } })).toThrow('unknown key "delay"');
    expect(() => parsePresets({ presets: { x: { ...ok.eyebrow, status: 'approved' } } })).toThrow('"system" or "experimental"');
    expect(() => parsePresets({ presets: { x: { ...ok.eyebrow, blur: 4 } } })).toThrow('unknown key "blur"');
    expect(() => parsePresets({ presets: { x: { rise: 'distance.8' } } })).toThrow('Preset "x".move');
  });
});

describe('validatePresetTokens', () => {
  const table = (over: object) => parsePresets({ presets: { x: { ...ok.eyebrow, ...over } } });

  it('passes a preset whose tokens exist', () => {
    expect(validatePresetTokens(table({}), raw)).toEqual([]);
    expect(validatePresetTokens(table({ scale: 'scale.95' }), raw)).toEqual([]);
  });

  it('names a token that does not exist', () => {
    expect(validatePresetTokens(table({ rise: 'distance.99' }), raw)).toEqual(['Preset "x" rise: no token "distance.99"']);
    expect(validatePresetTokens(table({ move: { duration: 'duration.1', easing: 'easing.expressive-entrance' } }), raw)).toEqual(['Preset "x" move duration: no token "duration.1"']);
  });

  it('names a token that is the wrong kind (a distance that is not in px, an easing that is not a curve)', () => {
    expect(validatePresetTokens(table({}), { ...raw, 'distance.16': 16 })).toEqual(['Preset "x" rise: "distance.16" is not a distance token']);
    expect(validatePresetTokens(table({}), { ...raw, 'easing.productive-entrance': '300ms' })).toEqual(['Preset "x" fade easing: "easing.productive-entrance" is not a easing token']);
  });
});
