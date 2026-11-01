import { describe, it, expect } from 'vitest';
import {
  compileTokens, resolveTokenValue, tokenVarName, findRefs, resolveRefs, tokenCss, tokenLabel,
} from '../../lab/lib/token-compiler.js';
import type { DtcgGroup } from '../../lab/lib/types.js';
import tokensJson from '../../tokens/motion.json';

const sample = (over: Partial<Record<string, unknown>> = {}): DtcgGroup => ({
  duration: {
    '100': { $type: 'duration', $value: '100ms' },
    '300': { $type: 'duration', $value: '300ms' },
  },
  easing: {
    'productive-standard': {
      $type: 'cubicBezier',
      $value: [0.2, 0, 0.38, 0.9],
      $extensions: { status: 'system' },
    },
    'productive-exit': { $type: 'cubicBezier', $value: [0.2, 0, 1, 0.9] },
  },
  distance: { '16': { $type: 'dimension', $value: '16px' } },
  scale: { '95': { $type: 'number', $value: 0.95 } },
  ...over,
} as unknown as DtcgGroup);

describe('compileTokens', () => {
  it('compiles duration, easing, dimension and number tokens to CSS vars, with a motion prefix', () => {
    const { cssVars } = compileTokens(sample());
    expect(cssVars['--motion-duration-100']).toBe('100ms');
    expect(cssVars['--motion-easing-productive-standard']).toBe('cubic-bezier(0.2, 0, 0.38, 0.9)');
    expect(cssVars['--motion-distance-16']).toBe('16px');
    expect(cssVars['--motion-scale-95']).toBe('0.95');
  });

  it('keeps every value in raw by path, with no motion root', () => {
    const { raw } = compileTokens(sample());
    expect(raw['duration.300']).toBe('300ms');
    expect(raw['easing.productive-exit']).toEqual([0.2, 0, 1, 0.9]);
    expect(raw['scale.95']).toBe(0.95);
    expect(tokenVarName('duration.300')).toBe('--motion-duration-300');
  });

  it('throws on an unknown $type, bad cubicBezier, and bad duration, dimension or number values', () => {
    expect(() => compileTokens({ bad: { $type: 'unknown-type', $value: 'x' } } as never)).toThrow('unknown $type');
    expect(() => compileTokens({ bad: { $type: 'cubicBezier', $value: [0, 0] } } as never)).toThrow('cubicBezier');
    expect(() => compileTokens({ bad: { $type: 'duration', $value: 300 } } as never)).toThrow('duration');
    expect(() => compileTokens({ bad: { $type: 'dimension', $value: 16 } } as never)).toThrow('dimension');
    expect(() => compileTokens({ bad: { $type: 'number', $value: '1' } } as never)).toThrow('number');
  });

  it('no longer knows composite or spring token types', () => {
    expect(() => compileTokens({ t: { $type: 'transition', $value: {} } } as never)).toThrow('unknown $type');
    expect(() => compileTokens({ s: { $type: 'custom-spring', $value: {} } } as never)).toThrow('unknown $type');
  });
});

describe('status, notes and old names', () => {
  it('reads status, $description and oldNames; a token with no status is experimental', () => {
    const { meta } = compileTokens(sample({
      delay: {
        '40': { $type: 'duration', $value: '40ms', $description: 'Short offsets', $extensions: { status: 'system', oldNames: ['delay-xs'] } },
        '70': { $type: 'duration', $value: '70ms' },
      },
    }));
    expect(meta['delay.40']).toEqual({ status: 'system', description: 'Short offsets', oldNames: ['delay-xs'] });
    expect(meta['delay.70']).toEqual({ status: 'experimental' });
  });

  it('rejects an unknown status or malformed oldNames', () => {
    const bad = (ext: unknown): DtcgGroup => ({ delay: { '40': { $type: 'duration', $value: '40ms', $extensions: ext } } } as never);
    expect(() => compileTokens(bad({ status: 'approved' }))).toThrow('"system" or "experimental"');
    expect(() => compileTokens(bad({ oldNames: 'delay-xs' }))).toThrow('oldNames');
    expect(() => compileTokens(bad({ oldNames: [1] }))).toThrow('oldNames');
  });
});

describe('resolveTokenValue', () => {
  it('resolves a known token path, and throws on an unknown one', () => {
    const { raw } = compileTokens(sample());
    expect(resolveTokenValue('duration.100', raw)).toBe('100ms');
    expect(() => resolveTokenValue('duration.nonexistent', raw)).toThrow('Unknown token path');
  });
});

describe('references in keyframes', () => {
  const { raw } = compileTokens(sample());

  it('finds the tokens a value names', () => {
    expect(findRefs('translateY({distance.16}) scale({scale.95})')).toEqual(['distance.16', 'scale.95']);
    expect(findRefs('translateY(0px)')).toEqual([]);
  });

  it('replaces a reference with its value; a leading minus negates it', () => {
    expect(resolveRefs('translateY({distance.16})', raw)).toBe('translateY(16px)');
    expect(resolveRefs('translateY(-{distance.16})', raw)).toBe('translateY(-16px)');
    expect(resolveRefs('{scale.95}', raw)).toBe('0.95');
    expect(resolveRefs('translateY(0px)', raw)).toBe('translateY(0px)');
  });

  it('for the CSS export, uses the custom property with the value as fallback; a negative becomes calc', () => {
    expect(resolveRefs('translateY({distance.16})', raw, { cssVars: true })).toBe('translateY(var(--motion-distance-16, 16px))');
    expect(resolveRefs('translateY(-{distance.16})', raw, { cssVars: true })).toBe('translateY(calc(-1 * var(--motion-distance-16, 16px)))');
  });

  it('throws on an unknown token, or one with no single value', () => {
    expect(() => resolveRefs('{distance.99}', raw)).toThrow('Unknown token reference: "{distance.99}"');
  });
});

describe('tokenCss and tokenLabel', () => {
  const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

  it('tokenCss returns durations as strings and easings as cubic-bezier()', () => {
    expect(tokenCss(raw, 'duration.300')).toBe('300ms');
    expect(tokenCss(raw, 'easing.productive-standard')).toBe('cubic-bezier(0.2, 0, 0.38, 0.9)');
    expect(tokenCss(raw, 'easing.linear')).toBe('cubic-bezier(0, 0, 1, 1)');
  });

  it('tokenCss passes a literal through', () => {
    expect(tokenCss(raw, '240ms')).toBe('240ms');
  });

  it('tokenLabel names a token within its group', () => {
    expect(tokenLabel('easing.productive-standard')).toBe('productive-standard');
    expect(tokenLabel('duration.300')).toBe('300');
  });
});

describe('the real token file', () => {
  const { raw, meta } = compileTokens(tokensJson as unknown as DtcgGroup);
  // In token-file order. JS puts whole-number keys first, so the scales are compared smallest to largest.
  const names = (kind: string): string[] => Object.keys(raw).filter(k => k.startsWith(`${kind}.`)).map(k => k.slice(kind.length + 1));
  const sorted = (kind: string): string[] => names(kind).sort((a, b) => Number(a) - Number(b));

  it('has no composite tokens and no motion root', () => {
    expect(names('transforms')).toEqual([]);
    expect(names('springs')).toEqual([]);
    expect(names('bounce')).toEqual([]);
    expect(Object.keys(raw).some(k => k.startsWith('motion.'))).toBe(false);
  });

  it('has the value-named scales', () => {
    expect(sorted('duration')).toEqual(['100', '140', '220', '300', '400', '560', '800', '1200']);
    expect(sorted('distance')).toEqual(['4', '8', '12', '16', '24', '32', '40', '48']);
    expect(sorted('scale')).toEqual(['60', '75', '90', '95', '96', '97', '98', '99', '103', '106']);
    expect(sorted('opacity')).toEqual(['04', '08', '10', '56']);
    expect(sorted('delay')).toEqual(['40', '70', '120']);
  });

  it('each value matches its name', () => {
    for (const [kind, unit] of [['duration', 'ms'], ['distance', 'px'], ['delay', 'ms']] as const) {
      for (const n of names(kind)) expect(raw[`${kind}.${n}`]).toBe(`${n}${unit}`);
    }
    for (const n of names('scale')) expect(raw[`scale.${n}`]).toBeCloseTo(Number(n) / 100, 5);
    for (const n of names('opacity')) expect(raw[`opacity.${n}`]).toBeCloseTo(Number(n) / 100, 5);
  });

  it('has the easings in system order', () => {
    expect(names('easing')).toEqual([
      'productive-standard', 'productive-entrance', 'productive-exit',
      'expressive-standard', 'expressive-entrance', 'expressive-exit', 'expressive-settle', 'expressive-bounce',
      'linear',
    ]);
  });

  it('has no spring forms: easing is the only family', () => {
    expect(Object.keys(raw).some(k => k.endsWith('.spring'))).toBe(false);
  });

  it('every token has a status, and the two placeholder curves are experimental', () => {
    for (const path of Object.keys(raw)) expect(meta[path]?.status).toMatch(/^(system|experimental)$/);
    expect(meta['easing.expressive-settle']?.status).toBe('experimental');
    expect(meta['easing.expressive-bounce']?.status).toBe('experimental');
    expect(meta['duration.300']?.status).toBe('system');
  });
});
