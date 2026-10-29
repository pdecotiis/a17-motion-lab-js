import { describe, it, expect } from 'vitest';
import { getTokenRefs, buildUsageIndex, buildPageUsageIndex, getLiveOverrides, getSpringFallbackPath } from '../../lab/lib/token-refs.js';
import { buildVersionCss } from '../../lab/lib/css-output.js';
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

describe('buildPageUsageIndex', () => {
  const defaults = new Map<string, MotionVersion>([
    ['card', tweenVersion],
    ['hero', springVersion],
  ]);

  it('maps tokens to the pages that use them via default versions', () => {
    const pages = [
      { id: 'home', title: 'Home', components: [{ id: 'c1', component: 'card' }] },
      { id: 'about', title: 'About', components: [{ id: 'h1', component: 'hero' }] },
    ];
    const index = buildPageUsageIndex(pages, defaults, raw);
    expect(index.get('motion.timings.base')).toEqual(['home']);
    expect(index.get('motion.easings.ease-out')).toEqual(['home']);
    expect(index.get('motion.springs.bouncy')).toEqual(['about']);
  });

  it('lists a page once even when a component appears several times', () => {
    const pages = [{
      id: 'home', title: 'Home',
      components: [{ id: 'c1', component: 'card' }, { id: 'c2', component: 'card' }],
    }];
    expect(buildPageUsageIndex(pages, defaults, raw).get('motion.timings.base')).toEqual(['home']);
  });

  it('drops a page from a token when its component is removed', () => {
    const page = { id: 'home', title: 'Home', components: [{ id: 'c1', component: 'card' }] };
    expect(buildPageUsageIndex([page], defaults, raw).has('motion.timings.base')).toBe(true);
    const removed = { ...page, components: [] };
    expect(buildPageUsageIndex([removed], defaults, raw).has('motion.timings.base')).toBe(false);
  });

  it('ignores components with no registered default version', () => {
    const pages = [{ id: 'home', title: 'Home', components: [{ id: 'x', component: 'missing' }] }];
    expect(buildPageUsageIndex(pages, defaults, raw).size).toBe(0);
  });
});

describe('buildUsageIndex — adding and removing references', () => {
  it('reflects a version added and then removed', () => {
    const before = buildUsageIndex([{ componentName: 'card', version: tweenVersion }], raw);
    expect(before.has('motion.springs.bouncy')).toBe(false);
    const added = buildUsageIndex([
      { componentName: 'card', version: tweenVersion },
      { componentName: 'card', version: springVersion },
    ], raw);
    expect(added.get('motion.springs.bouncy')).toEqual([
      { componentName: 'card', versionId: 'v2', versionLabel: 'Scale In' },
    ]);
    const removed = buildUsageIndex([{ componentName: 'card', version: springVersion }], raw);
    expect(removed.has('motion.timings.base')).toBe(false);
  });
});

describe('spring cubic-bezier fallback token', () => {
  const rawWithFallback: Record<string, unknown> = {
    ...raw,
    'motion.easings.spring-base': [0.34, 1.56, 0.64, 1.0],
    'motion.springs.bouncy': { bounce: 0.4, duration: 600, fallback: 'motion.easings.spring-base' },
  };

  it('resolves the fallback path when the spring token names a cubicBezier token', () => {
    expect(getSpringFallbackPath(springVersion.model as never, rawWithFallback)).toBe('motion.easings.spring-base');
  });

  it('returns undefined when there is no fallback or it is not a cubicBezier token', () => {
    expect(getSpringFallbackPath(springVersion.model as never, raw)).toBeUndefined();
    const bad = { ...raw, 'motion.springs.bouncy': { bounce: 0.4, duration: 600, fallback: 'motion.nope' } };
    expect(getSpringFallbackPath(springVersion.model as never, bad)).toBeUndefined();
  });

  it('counts the fallback token as used by the version', () => {
    expect(getTokenRefs(springVersion, rawWithFallback).tokens).toContain('motion.easings.spring-base');
  });

  it('emits the fallback token value in generated CSS, else a derived cubic-bezier', () => {
    const withToken = buildVersionCss(springVersion, rawWithFallback, { mode: 'spring' });
    expect(withToken).toContain('cubic-bezier fallback (motion.easings.spring-base): cubic-bezier(0.34, 1.56, 0.64, 1)');
    const derived = buildVersionCss(springVersion, raw, { mode: 'spring' });
    expect(derived).toMatch(/cubic-bezier fallback: cubic-bezier\(/);
  });
});

describe('getLiveOverrides', () => {
  const initial = { duration: 300, delay: 0, easing: 'cubic-bezier(0, 0, 0.2, 1)' };

  it('returns nothing when controls match the version', () => {
    expect(getLiveOverrides(initial, { duration: '300ms', delay: '0ms', easing: 'cubic-bezier(0,0,0.2,1)' })).toEqual([]);
    expect(getLiveOverrides(initial, {})).toEqual([]);
  });

  it('flags each changed control with before and after', () => {
    const o = getLiveOverrides(initial, { duration: '450ms', delay: '50ms', easing: 'ease-in' });
    expect(o.map(x => x.label)).toEqual(['duration', 'delay', 'easing']);
    expect(o[0]).toEqual({ label: 'duration', from: '300ms', to: '450ms' });
  });

  it('flags only the control that changed', () => {
    const o = getLiveOverrides(initial, { duration: '300ms', delay: '0ms', easing: 'ease-in' });
    expect(o.map(x => x.label)).toEqual(['easing']);
  });
});
