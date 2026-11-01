import { describe, it, expect } from 'vitest';
import { controlOptions, controlsFor, tokenCss, tokenLabel } from '../../lab/lib/control-options.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('tokenCss and tokenLabel', () => {
  it('returns duration tokens as strings and easing tokens as cubic-bezier()', () => {
    expect(tokenCss(raw, 'duration.300')).toBe('300ms');
    expect(tokenCss(raw, 'easing.productive-standard')).toBe('cubic-bezier(0.2, 0, 0.38, 0.9)');
    expect(tokenCss(raw, 'easing.linear')).toBe('cubic-bezier(0, 0, 1, 1)');
  });

  it('passes a literal through and returns undefined for a spring form', () => {
    expect(tokenCss(raw, '240ms')).toBe('240ms');
    expect(tokenCss(raw, 'easing.expressive-settle.spring')).toBeUndefined();
  });

  it('names a token within its group', () => {
    expect(tokenLabel('easing.productive-standard')).toBe('productive-standard');
    expect(tokenLabel('duration.300')).toBe('300');
  });
});

describe('controlOptions', () => {
  it('lists every duration token for a tween, as its value', () => {
    expect(controlOptions(raw, 'duration', 'tween').map(o => o.label)).toEqual([
      '100ms', '140ms', '220ms', '300ms', '400ms', '560ms', '800ms', '1200ms',
    ]);
    expect(controlOptions(raw, 'duration', 'tween')[3]).toEqual({ value: 'duration.300', label: '300ms' });
  });

  it('lists every easing for a tween, in system order, never a spring form', () => {
    const options = controlOptions(raw, 'easing', 'tween');
    expect(options.map(o => o.label)).toEqual([
      'productive-standard', 'productive-entrance', 'productive-exit',
      'expressive-standard', 'expressive-entrance', 'expressive-exit', 'expressive-settle', 'expressive-bounce',
      'linear',
    ]);
    expect(options.every(o => !o.value.endsWith('.spring'))).toBe(true);
  });

  it('offers a spring only the easings that have a spring form: no exits, no linear', () => {
    expect(controlOptions(raw, 'easing', 'spring').map(o => o.label)).toEqual([
      'productive-standard', 'productive-entrance',
      'expressive-standard', 'expressive-entrance', 'expressive-settle', 'expressive-bounce',
    ]);
  });

  it('offers a spring the same durations as a tween', () => {
    expect(controlOptions(raw, 'duration', 'spring')).toEqual(controlOptions(raw, 'duration', 'tween'));
  });

  it('offers nothing but durations and easings: no transforms, no free-form values', () => {
    const all = [...controlOptions(raw, 'duration', 'tween'), ...controlOptions(raw, 'easing', 'tween')];
    expect(all.every(o => /^(duration|easing)\./.test(o.value))).toBe(true);
  });
});

describe('controlsFor', () => {
  it('a tween previews the picked duration and easing', () => {
    expect(controlsFor(raw, 'tween', { duration: 'duration.560', easing: 'easing.expressive-entrance' })).toEqual({
      duration: '560ms',
      easing: 'cubic-bezier(0, 0, 0.3, 1)',
    });
  });

  it('a spring previews the picked duration, and takes the bounce of the picked easing', () => {
    expect(controlsFor(raw, 'spring', { duration: 'duration.560', easing: 'easing.expressive-bounce' })).toEqual({
      duration: '560ms',
      bounce: 0.25,
    });
    expect(controlsFor(raw, 'spring', { easing: 'easing.productive-standard' })).toEqual({ bounce: 0 });
  });

  it('a spring ignores an easing that has no spring form', () => {
    expect(controlsFor(raw, 'spring', { easing: 'easing.productive-exit' })).toEqual({});
  });

  it('nothing picked, or an unknown path, overrides nothing', () => {
    expect(controlsFor(raw, 'tween', {})).toEqual({});
    expect(controlsFor(raw, 'tween', { duration: '', easing: '' })).toEqual({});
    expect(controlsFor(raw, 'tween', { duration: 'duration.nope', easing: 'easing.nope' })).toEqual({});
  });
});
