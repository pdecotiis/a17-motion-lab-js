import { describe, it, expect } from 'vitest';
import { compileTokens, resolveTokenValue } from '../../lab/lib/token-compiler.js';
import type { DtcgGroup } from '../../lab/lib/types.js';

const sampleTokens: DtcgGroup = {
  duration: {
    fast: { $type: 'duration', $value: '150ms' },
    base: { $type: 'duration', $value: '300ms' },
  },
  easing: {
    'ease-out': { $type: 'cubicBezier', $value: [0.0, 0.0, 0.2, 1.0] },
  },
  distance: {
    sm: { $type: 'dimension', $value: '8px' },
  },
  springs: {
    bouncy: { $type: 'custom-spring', $value: { bounce: 0.4, duration: 600 } },
  },
};

describe('compileTokens', () => {
  it('compiles duration tokens to CSS vars', () => {
    const { cssVars } = compileTokens(sampleTokens);
    expect(cssVars['--motion-duration-fast']).toBe('150ms');
    expect(cssVars['--motion-duration-base']).toBe('300ms');
  });

  it('compiles cubicBezier tokens to CSS vars', () => {
    const { cssVars } = compileTokens(sampleTokens);
    expect(cssVars['--motion-easing-ease-out']).toBe('cubic-bezier(0, 0, 0.2, 1)');
  });

  it('compiles dimension tokens to CSS vars', () => {
    const { cssVars } = compileTokens(sampleTokens);
    expect(cssVars['--motion-distance-sm']).toBe('8px');
  });

  it('stores spring tokens in raw but not CSS vars', () => {
    const { cssVars, raw } = compileTokens(sampleTokens);
    expect(cssVars['--motion-springs-bouncy']).toBeUndefined();
    expect(raw['springs.bouncy']).toEqual({ bounce: 0.4, duration: 600 });
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
    const val = resolveTokenValue('duration.fast', raw);
    expect(val).toBe('150ms');
  });

  it('throws on unknown path', () => {
    const { raw } = compileTokens(sampleTokens);
    expect(() => resolveTokenValue('duration.nonexistent', raw)).toThrow('Unknown token path');
  });
});

describe('transform tokens', () => {
  const withTransforms = (transforms: DtcgGroup): DtcgGroup => ({ ...sampleTokens, transforms });
  const entrance = {
    $type: 'transition',
    $value: { duration: '{duration.base}', timingFunction: '{easing.ease-out}' },
  };

  it('resolves to the duration and easing token paths, raw only (no CSS variable)', () => {
    const { raw, cssVars } = compileTokens(withTransforms({ entrance } as never));
    expect(raw['transforms.entrance']).toEqual({
      duration: 'duration.base',
      easing: 'easing.ease-out',
    });
    expect(Object.keys(cssVars).some(k => k.includes('transforms'))).toBe(false);
  });

  it('can refer to tokens defined later in the file', () => {
    const group = {
      transforms: { entrance },
      duration: sampleTokens['duration'],
      easing: sampleTokens['easing'],
    } as DtcgGroup;
    expect(() => compileTokens(group)).not.toThrow();
  });

  it('passes literal values through and keeps an optional delay', () => {
    const { raw } = compileTokens(withTransforms({
      custom: { $type: 'transition', $value: { duration: '240ms', timingFunction: '{easing.ease-out}', delay: '{duration.fast}' } },
    } as never));
    expect(raw['transforms.custom']).toEqual({
      duration: '240ms',
      easing: 'easing.ease-out',
      delay: 'duration.fast',
    });
  });

  it('rejects a reference to a token that does not exist', () => {
    const bad = { $type: 'transition', $value: { duration: '{duration.nope}', timingFunction: '{easing.ease-out}' } };
    expect(() => compileTokens(withTransforms({ bad } as never))).toThrow('unknown token "duration.nope"');
  });

  it('rejects a reference to the wrong kind of token', () => {
    const swapped = { $type: 'transition', $value: { duration: '{easing.ease-out}', timingFunction: '{duration.base}' } };
    expect(() => compileTokens(withTransforms({ swapped } as never))).toThrow('is not a duration token');
  });

  it('rejects a transition with no easing', () => {
    const bad = { $type: 'transition', $value: { duration: '{duration.base}' } };
    expect(() => compileTokens(withTransforms({ bad } as never))).toThrow('timingFunction');
  });

  it('the real token file compiles, and its transforms point at real tokens', async () => {
    const { default: tokensJson } = await import('../../tokens/motion.json');
    const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);
    for (const name of ['entrance', 'exit', 'standard', 'emphasized']) {
      const t = raw[`transforms.${name}`] as { duration: string; easing: string };
      expect(typeof raw[t.duration]).toBe('string');
      expect(Array.isArray(raw[t.easing])).toBe(true);
    }
  });
});
