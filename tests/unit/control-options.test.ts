import { describe, it, expect } from 'vitest';
import { controlOptions, controlsFor, tokenCss, tokenLabel, durationLabel } from '../../lab/lib/control-options.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('tokenCss', () => {
  it('returns duration tokens as strings and cubicBezier tokens as cubic-bezier()', () => {
    expect(tokenCss(raw, 'duration.250')).toBe('250ms');
    expect(tokenCss(raw, 'easing.productive.entrance')).toBe('cubic-bezier(0, 0, 0.38, 0.9)');
  });

  it('passes a literal through and returns undefined for spring and transform tokens', () => {
    expect(tokenCss(raw, '240ms')).toBe('240ms');
    expect(tokenCss(raw, 'springs.bouncy')).toBeUndefined();
    expect(tokenCss(raw, 'transforms.entrance')).toBeUndefined();
  });
});

describe('tokenLabel and durationLabel', () => {
  it('names a token within its group, keeping a nested name whole', () => {
    expect(tokenLabel('transforms.entrance')).toBe('entrance');
    expect(tokenLabel('easing.productive.entrance')).toBe('productive.entrance');
    expect(tokenLabel('easing.expressive.entrance')).toBe('expressive.entrance');
    expect(tokenLabel('duration.250')).toBe('250');
  });

  it('shows a duration named for its value as just the value', () => {
    expect(durationLabel(raw, 'duration.250')).toBe('250ms');
  });

  it('shows a duration named otherwise with its name, and a literal as it is', () => {
    expect(durationLabel({ 'duration.base': '300ms' }, 'duration.base')).toBe('base · 300ms');
    expect(durationLabel(raw, '240ms')).toBe('240ms');
  });
});

describe('controlOptions', () => {
  it('lists the transforms in token-file order, with name and what they are', () => {
    const options = controlOptions(raw, 'transforms');
    expect(options.map(o => o.label)).toEqual(['entrance', 'exit', 'standard', 'emphasized']);
    expect(options[0]).toEqual({ value: 'transforms.entrance', label: 'entrance', detail: '250ms · productive.entrance' });
    expect(options.find(o => o.label === 'exit')!.detail).toBe('150ms · productive.exit');
    expect(options.find(o => o.label === 'emphasized')!.detail).toBe('400ms · expressive.entrance');
  });

  it('lists the springs', () => {
    const options = controlOptions(raw, 'springs');
    expect(options.map(o => o.label)).toEqual(['bouncy', 'gentle', 'stiff']);
    expect(options[0]!.detail).toBe('bounce 0.4 · 600ms');
  });

  it('offers no granular duration, easing or delay controls', () => {
    const all = [...controlOptions(raw, 'transforms'), ...controlOptions(raw, 'springs')];
    expect(all.every(o => !o.value.startsWith('duration.') && !o.value.startsWith('easing.'))).toBe(true);
  });
});

describe('controlsFor', () => {
  it('a transform previews its duration and easing', () => {
    expect(controlsFor(raw, 'transforms', 'transforms.emphasized')).toEqual({
      duration: '400ms',
      easing: 'cubic-bezier(0, 0, 0.3, 1)',
    });
  });

  it('a spring previews its duration and bounce', () => {
    expect(controlsFor(raw, 'springs', 'springs.gentle')).toEqual({ duration: '400ms', bounce: 0.1 });
  });

  it('the version default (empty) and unknown paths override nothing', () => {
    expect(controlsFor(raw, 'transforms', '')).toEqual({});
    expect(controlsFor(raw, 'transforms', 'transforms.nope')).toEqual({});
    expect(controlsFor(raw, 'springs', 'springs.nope')).toEqual({});
  });
});
