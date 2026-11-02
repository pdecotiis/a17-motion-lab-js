import { describe, it, expect } from 'vitest';
import { DEFAULT_STAGGER, delayTokenPaths, staggerFromParam, pageStaggerToken } from '../../lab/lib/stagger.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);
const tokens = delayTokenPaths(raw);

describe('stagger', () => {
  it('the default is delay.70, and it is a real delay token', () => {
    expect(DEFAULT_STAGGER).toBe('delay.70');
    expect(raw[DEFAULT_STAGGER]).toBe('70ms');
  });

  it('delayTokenPaths lists the delay tokens, smallest first, and nothing else', () => {
    expect(tokens).toEqual(['delay.40', 'delay.70', 'delay.120']);
    expect(delayTokenPaths({ 'delay.120': '120ms', 'delay.40': '40ms', 'duration.300': '300ms' })).toEqual(['delay.40', 'delay.120']);
  });

  it('staggerFromParam turns a URL value into a delay token, or falls back', () => {
    expect(staggerFromParam('120', tokens, DEFAULT_STAGGER)).toBe('delay.120');
    expect(staggerFromParam('80', tokens, DEFAULT_STAGGER)).toBe('delay.70');
    expect(staggerFromParam('none', tokens, DEFAULT_STAGGER)).toBe('delay.70');
    expect(staggerFromParam(null, tokens, 'delay.40')).toBe('delay.40');
  });

  it('a page uses its own choice, else the default setting, and none means no stagger', () => {
    expect(pageStaggerToken(undefined, tokens, 'delay.120')).toBe('delay.120');
    expect(pageStaggerToken('default', tokens, 'delay.120')).toBe('delay.120');
    expect(pageStaggerToken('40', tokens, 'delay.120')).toBe('delay.40');
    expect(pageStaggerToken('none', tokens, 'delay.120')).toBeNull();
    expect(pageStaggerToken('999', tokens, 'delay.70')).toBe('delay.70');
  });
});
