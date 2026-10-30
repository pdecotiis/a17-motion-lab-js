import { describe, it, expect } from 'vitest';
import { CUSTOM_VALUE, ZERO_VALUE, delayOptions, resolveControlValue, tokenCss, tokenOptions } from '../../lab/lib/control-options.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('tokenCss', () => {
  it('returns duration tokens as strings and cubicBezier tokens as cubic-bezier()', () => {
    expect(tokenCss(raw, 'motion.timings.base')).toBe('300ms');
    expect(tokenCss(raw, 'motion.easings.ease-out')).toBe('cubic-bezier(0, 0, 0.2, 1)');
  });

  it('returns undefined for unknown paths and spring tokens', () => {
    expect(tokenCss(raw, 'motion.nope')).toBeUndefined();
    expect(tokenCss(raw, 'motion.springs.bouncy')).toBeUndefined();
  });
});

describe('tokenOptions', () => {
  it('lists every timing token with its value, and only timing tokens', () => {
    const options = tokenOptions(raw, 'timings');
    expect(options.map(o => o.value)).toEqual([
      'motion.timings.fast', 'motion.timings.base', 'motion.timings.slow', 'motion.timings.slower',
    ]);
    expect(options[1]!.label).toBe('base · 300ms');
  });

  it('lists every easing token', () => {
    const options = tokenOptions(raw, 'easings');
    expect(options.map(o => o.value)).toContain('motion.easings.ease-out');
    expect(options.every(o => o.value.startsWith('motion.easings.'))).toBe(true);
    expect(options.find(o => o.value === 'motion.easings.ease-out')!.label).toBe('ease-out · cubic-bezier(0, 0, 0.2, 1)');
  });
});

describe('resolveControlValue', () => {
  it('means no override for the version default', () => {
    expect(resolveControlValue(raw, '', '500', 'ms')).toBeUndefined();
  });

  it('resolves a token to its CSS value', () => {
    expect(resolveControlValue(raw, 'motion.timings.slow', '', 'ms')).toBe('500ms');
    expect(resolveControlValue(raw, 'motion.easings.ease-in', '')).toBe('cubic-bezier(0.4, 0, 1, 1)');
  });

  it('takes the typed value for custom, adding ms to bare numbers', () => {
    expect(resolveControlValue(raw, CUSTOM_VALUE, '425', 'ms')).toBe('425ms');
    expect(resolveControlValue(raw, CUSTOM_VALUE, '0.5s', 'ms')).toBe('0.5s');
    expect(resolveControlValue(raw, CUSTOM_VALUE, 'cubic-bezier(0,0,1,1)')).toBe('cubic-bezier(0,0,1,1)');
  });

  it('offers "none" plus the timing tokens for delay, and resolves none to 0ms', () => {
    const options = delayOptions(raw);
    expect(options[0]).toEqual({ value: ZERO_VALUE, label: 'none · 0ms' });
    expect(options.slice(1)).toEqual(tokenOptions(raw, 'timings'));
    expect(resolveControlValue(raw, ZERO_VALUE, '', 'ms')).toBe('0ms');
  });

  it('means no override for an empty custom value', () => {
    expect(resolveControlValue(raw, CUSTOM_VALUE, '  ', 'ms')).toBeUndefined();
  });
});
