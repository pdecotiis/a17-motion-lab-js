import { describe, it, expect } from 'vitest';
import { compileTokens, resolveTokenValue } from '../../lab/lib/token-compiler.js';
import type { DtcgGroup } from '../../lab/lib/types.js';

const sampleTokens: DtcgGroup = {
  motion: {
    timings: {
      fast: { $type: 'duration', $value: '150ms' },
      base: { $type: 'duration', $value: '300ms' },
    },
    easings: {
      'ease-out': { $type: 'cubicBezier', $value: [0.0, 0.0, 0.2, 1.0] },
    },
    distances: {
      sm: { $type: 'dimension', $value: '8px' },
    },
    springs: {
      bouncy: { $type: 'custom-spring', $value: { bounce: 0.4, duration: 600 } },
    },
  },
};

describe('compileTokens', () => {
  it('compiles duration tokens to CSS vars', () => {
    const { cssVars } = compileTokens(sampleTokens);
    expect(cssVars['--motion-motion-timings-fast']).toBe('150ms');
    expect(cssVars['--motion-motion-timings-base']).toBe('300ms');
  });

  it('compiles cubicBezier tokens to CSS vars', () => {
    const { cssVars } = compileTokens(sampleTokens);
    expect(cssVars['--motion-motion-easings-ease-out']).toBe('cubic-bezier(0, 0, 0.2, 1)');
  });

  it('compiles dimension tokens to CSS vars', () => {
    const { cssVars } = compileTokens(sampleTokens);
    expect(cssVars['--motion-motion-distances-sm']).toBe('8px');
  });

  it('stores spring tokens in raw but not CSS vars', () => {
    const { cssVars, raw } = compileTokens(sampleTokens);
    expect(cssVars['--motion-motion-springs-bouncy']).toBeUndefined();
    expect(raw['motion.springs.bouncy']).toEqual({ bounce: 0.4, duration: 600 });
  });

  it('throws on unknown $type', () => {
    const badTokens: DtcgGroup = {
      bad: { $type: 'unknown-type', $value: 'x' } as never,
    };
    expect(() => compileTokens(badTokens)).toThrow('unknown $type');
  });

  it('throws on invalid cubicBezier (wrong length)', () => {
    const badTokens: DtcgGroup = {
      bad: { $type: 'cubicBezier', $value: [0, 0] } as never,
    };
    expect(() => compileTokens(badTokens)).toThrow('cubicBezier');
  });

  it('throws on non-string duration', () => {
    const badTokens: DtcgGroup = {
      bad: { $type: 'duration', $value: 300 } as never,
    };
    expect(() => compileTokens(badTokens)).toThrow('duration');
  });
});

describe('resolveTokenValue', () => {
  it('resolves a known token path', () => {
    const { raw } = compileTokens(sampleTokens);
    const val = resolveTokenValue('motion.timings.fast', raw);
    expect(val).toBe('150ms');
  });

  it('throws on unknown path', () => {
    const { raw } = compileTokens(sampleTokens);
    expect(() => resolveTokenValue('motion.timings.nonexistent', raw)).toThrow('Unknown token path');
  });
});
