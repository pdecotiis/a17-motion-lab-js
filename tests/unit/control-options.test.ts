import { describe, it, expect } from 'vitest';
import { controlOptions, controlsFor, tokenCss } from '../../lab/lib/control-options.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('tokenCss', () => {
  it('returns duration tokens as strings and cubicBezier tokens as cubic-bezier()', () => {
    expect(tokenCss(raw, 'motion.duration.base')).toBe('300ms');
    expect(tokenCss(raw, 'motion.easing.ease-out')).toBe('cubic-bezier(0, 0, 0.2, 1)');
  });

  it('passes a literal through and returns undefined for spring and transform tokens', () => {
    expect(tokenCss(raw, '240ms')).toBe('240ms');
    expect(tokenCss(raw, 'motion.springs.bouncy')).toBeUndefined();
    expect(tokenCss(raw, 'motion.transforms.entrance')).toBeUndefined();
  });
});

describe('controlOptions', () => {
  it('lists the transforms in token-file order, with name and what they are', () => {
    const options = controlOptions(raw, 'transforms');
    expect(options.map(o => o.label)).toEqual(['entrance', 'exit', 'standard', 'emphasized']);
    expect(options[0]).toEqual({ value: 'motion.transforms.entrance', label: 'entrance', detail: '300ms · ease-out' });
    expect(options.find(o => o.label === 'exit')!.detail).toBe('150ms · ease-in');
  });

  it('lists the springs', () => {
    const options = controlOptions(raw, 'springs');
    expect(options.map(o => o.label)).toEqual(['bouncy', 'gentle', 'stiff']);
    expect(options[0]!.detail).toBe('bounce 0.4 · 600ms');
  });

  it('offers no granular duration, easing or delay controls', () => {
    const all = [...controlOptions(raw, 'transforms'), ...controlOptions(raw, 'springs')];
    expect(all.every(o => !o.value.startsWith('motion.duration.') && !o.value.startsWith('motion.easing.'))).toBe(true);
  });
});

describe('controlsFor', () => {
  it('a transform previews its duration and easing', () => {
    expect(controlsFor(raw, 'transforms', 'motion.transforms.emphasized')).toEqual({
      duration: '500ms',
      easing: 'cubic-bezier(0, 0, 0.2, 1)',
    });
  });

  it('a spring previews its duration and bounce', () => {
    expect(controlsFor(raw, 'springs', 'motion.springs.gentle')).toEqual({ duration: '400ms', bounce: 0.1 });
  });

  it('the version default (empty) and unknown paths override nothing', () => {
    expect(controlsFor(raw, 'transforms', '')).toEqual({});
    expect(controlsFor(raw, 'transforms', 'motion.transforms.nope')).toEqual({});
    expect(controlsFor(raw, 'springs', 'motion.springs.nope')).toEqual({});
  });
});
