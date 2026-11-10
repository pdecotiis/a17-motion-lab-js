import { describe, it, expect } from 'vitest';
import { parsePresets } from '../../lab/lib/entrance-presets.js';
import { interactionOfPreset } from '../../lab/lib/preset-interaction.js';
import { validateMotionVersion } from '../../lab/lib/motion-models.js';
import { validateInteraction } from '../../lab/lib/interaction.js';
import { buildPresetsCss } from '../../lab/lib/css-output.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, MotionVersion } from '../../lab/lib/types.js';

// A preset's hover and press, used by an element of a component through the version's `elements`. They use the template's `ui` preset.
const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);
const T = { duration: 'duration.100', easing: 'easing.productive-standard' };

describe('a preset with an interaction (tokens/presets.json)', () => {
  const base = { rise: 'distance.8', move: T };
  const good = { hover: { tint: 0.04, timing: T }, press: { scale: 'scale.95', tint: 0.08, timing: T, release: T } };
  it('is read: hover and press with their tokens', () => {
    const table = parsePresets({ presets: { button: { ...base, interaction: good } } });
    expect(table.presets['button']!.interaction!.press!.scale).toBe('scale.95');
  });
  it('refuses a malformed one and says what is wrong', () => {
    expect(() => parsePresets({ presets: { b: { ...base, interaction: {} } } })).toThrow(/needs hover and\/or press/);
    expect(() => parsePresets({ presets: { b: { ...base, interaction: { hover: { tint: 0.9, timing: T } } } } })).toThrow(/tint/);
    expect(() => parsePresets({ presets: { b: { ...base, interaction: { press: { ...good.press, scale: 'distance.4' } } } } })).toThrow(/scale token/);
    expect(() => parsePresets({ presets: { b: { ...base, interaction: { press: { scale: 'scale.95', tint: 0.08, timing: T } } } } })).toThrow(/release/);
    expect(() => parsePresets({ presets: { b: { ...base, interaction: { drag: {} } } } })).toThrow(/unknown key "drag"/);
  });
});

describe('interactionOfPreset("ui")', () => {
  const i = interactionOfPreset('ui');
  it('is an ordinary interaction: default, hovered, pressed, with hover and press triggers on the element itself', () => {
    expect(Object.keys(i.states)).toEqual(['default', 'hovered', 'pressed']);
    expect(i.triggers).toEqual([{ on: 'hover', state: 'hovered' }, { on: 'press', state: 'pressed' }]);
    expect(() => validateInteraction({ id: 'x', label: 'x', interaction: i, lineage: 'x' } as MotionVersion)).not.toThrow();
  });
  it('darkens on hover, and scales and darkens on press', () => {
    expect(i.states['hovered']).toMatchObject({ filter: 'brightness(0.96)' });
    expect(i.states['pressed']).toMatchObject({ filter: 'brightness(0.92)', transform: 'scale({scale.95})' });
  });
  it('plays the press timing into pressed, the release timing into hovered, and the hover timing back to default', () => {
    expect(i.transitions['pressed']).toMatchObject({ duration: 'duration.100' });
    expect(i.transitions['hovered']).toMatchObject({ duration: 'duration.150', easing: 'easing.productive-entrance' });
    expect(i.transitions['default']).toMatchObject({ duration: 'duration.100', easing: 'easing.productive-standard' });
  });
});

describe('a version\'s elements', () => {
  const panel = (extra: Partial<MotionVersion>): MotionVersion => ({
    id: 'v9', label: 'Panel',
    interaction: { initial: 'closed', states: { closed: { opacity: 0 }, open: { opacity: 1 } }, transitions: { closed: { model: 'tween', ...T }, open: { model: 'tween', ...T } } },
    lineage: 'test', ...extra,
  });
  it('accepts an element that uses a preset with hover and press', () => {
    expect(() => validateMotionVersion(panel({ elements: { close: 'ui' } }))).not.toThrow();
  });
  it('refuses an unknown preset, a preset with no interaction, and a bad element name', () => {
    expect(() => validateMotionVersion(panel({ elements: { close: 'nope' } }))).toThrow(/unknown preset "nope"/);
    expect(() => validateMotionVersion(panel({ elements: { close: 'title' } }))).toThrow(/has no hover or press/);
    expect(() => validateMotionVersion(panel({ elements: { Close: 'ui' } }))).toThrow(/lowercase/);
  });
  it('refuses an element whose preset and component states move the same property of the same layer', () => {
    const v = panel({ elements: { close: 'ui' }, interaction: { initial: 'a', states: { a: {}, b: {} }, transitions: { a: { model: 'tween', ...T }, b: { model: 'tween', ...T } },
      layers: { close: { states: { a: { transform: 'none' }, b: { transform: 'translateX(4px)' } } } } } });
    expect(() => validateMotionVersion(v)).toThrow(/give them different elements/);
  });
  it('allows the component\'s states on other properties of the same layer', () => {
    const v = panel({ elements: { close: 'ui' }, interaction: { initial: 'a', states: { a: {}, b: {} }, transitions: { a: { model: 'tween', ...T }, b: { model: 'tween', ...T } },
      layers: { close: { states: { a: { opacity: 1 }, b: { opacity: 0 } } } } } });
    expect(() => validateMotionVersion(v)).not.toThrow();
  });
});

describe('the shared presets.css', () => {
  const css = buildPresetsCss(raw);
  it('writes hover and press as the states of .motion-interaction-<preset>', () => {
    expect(css).toContain('.motion-interaction-ui');
    expect(css).toContain('.motion-interaction-ui:hover');
    expect(css).toContain('.motion-interaction-ui:active');
    expect(css).toContain('filter: brightness(0.96)');
    expect(css).toContain('transform: scale(var(--motion-scale-95');
  });
  it('writes none for a preset that only enters', () => {
    expect(css).not.toContain('.motion-interaction-title');
  });
});
