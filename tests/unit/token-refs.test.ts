import { describe, it, expect } from 'vitest';
import { getTokenRefs, buildUsageIndex } from '../../lab/lib/token-refs.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const raw: Record<string, unknown> = {
  'motion.timings.base': '300ms',
  'motion.timings.slow': '500ms',
  'motion.easings.ease-out': [0.0, 0.0, 0.2, 1.0],
  'motion.springs.bouncy': { bounce: 0.4, duration: 600 },
};

const tweenVersion: MotionVersion = {
  id: 'v1',
  label: 'Fade Up',
  model: {
    model: 'tween',
    duration: 'motion.timings.base',
    easing: 'motion.easings.ease-out',
    delay: '0ms',
  },
  keyframes: [],
};

const springVersion: MotionVersion = {
  id: 'v2',
  label: 'Scale In',
  model: {
    model: 'spring',
    bounce: 0.4,
    duration: 'motion.springs.bouncy',
    properties: [{ property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1, span: 1 }],
  },
};

const hardcodedVersion: MotionVersion = {
  id: 'v3',
  label: 'Hardcoded',
  model: { model: 'tween', duration: '400ms', easing: 'ease-in', delay: '50ms' },
  keyframes: [],
};

describe('getTokenRefs', () => {
  it('extracts token paths from a tween version', () => {
    const { tokens } = getTokenRefs(tweenVersion, raw);
    expect(tokens).toContain('motion.timings.base');
    expect(tokens).toContain('motion.easings.ease-out');
  });

  it('extracts token paths from a spring version', () => {
    const { tokens } = getTokenRefs(springVersion, raw);
    expect(tokens).toContain('motion.springs.bouncy');
  });

  it('flags hard-coded values that are not token paths', () => {
    const { hardcoded } = getTokenRefs(hardcodedVersion, raw);
    expect(hardcoded.length).toBeGreaterThan(0);
    expect(hardcoded.some(h => h.value === '400ms')).toBe(true);
    expect(hardcoded.some(h => h.label === 'duration')).toBe(true);
  });

  it('does not flag zero delay (0ms) as hard-coded', () => {
    const { hardcoded } = getTokenRefs(tweenVersion, raw);
    expect(hardcoded.every(h => h.value !== '0ms')).toBe(true);
  });

  it('deduplicates repeated token references', () => {
    const dupVersion: MotionVersion = {
      id: 'v4', label: 'Dup',
      model: {
        model: 'tween',
        duration: 'motion.timings.base',
        easing: 'motion.timings.base',
      },
      keyframes: [],
    };
    const { tokens } = getTokenRefs(dupVersion, raw);
    const occurrences = tokens.filter(t => t === 'motion.timings.base').length;
    expect(occurrences).toBe(1);
  });

  it('returns empty arrays for a version with no token refs and no hardcoded values', () => {
    const noRefVersion: MotionVersion = {
      id: 'v5', label: 'Empty',
      model: { model: 'tween', duration: '0ms', easing: 'linear' },
      keyframes: [],
    };
    const { tokens, hardcoded } = getTokenRefs(noRefVersion, raw);
    expect(tokens.length).toBe(0);
    // 'linear' is a non-token hardcoded easing
    expect(hardcoded.some(h => h.value === 'linear')).toBe(true);
  });
});

describe('buildUsageIndex', () => {
  it('maps token paths to the versions that use them', () => {
    const allVersions = [
      { componentName: 'card', version: tweenVersion },
      { componentName: 'card', version: springVersion },
    ];
    const index = buildUsageIndex(allVersions, raw);

    expect(index.has('motion.timings.base')).toBe(true);
    const entries = index.get('motion.timings.base')!;
    expect(entries[0]!.componentName).toBe('card');
    expect(entries[0]!.versionId).toBe('v1');

    expect(index.has('motion.springs.bouncy')).toBe(true);
    expect(index.get('motion.springs.bouncy')![0]!.versionId).toBe('v2');
  });

  it('tokens used by multiple versions accumulate entries', () => {
    const v1b: MotionVersion = {
      id: 'v1b', label: 'Also uses base',
      model: { model: 'tween', duration: 'motion.timings.base', easing: 'ease' },
      keyframes: [],
    };
    const allVersions = [
      { componentName: 'card', version: tweenVersion },
      { componentName: 'hero', version: v1b },
    ];
    const index = buildUsageIndex(allVersions, raw);
    const entries = index.get('motion.timings.base')!;
    expect(entries.length).toBe(2);
    expect(entries.some(e => e.componentName === 'hero')).toBe(true);
  });

  it('tokens not referenced by any version are absent from the index', () => {
    const allVersions = [{ componentName: 'card', version: tweenVersion }];
    const index = buildUsageIndex(allVersions, raw);
    // motion.timings.slow and motion.springs.bouncy are not used by tweenVersion
    expect(index.has('motion.timings.slow')).toBe(false);
    expect(index.has('motion.springs.bouncy')).toBe(false);
  });

  it('returns an empty map when given no versions', () => {
    const index = buildUsageIndex([], raw);
    expect(index.size).toBe(0);
  });
});
