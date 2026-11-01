import { describe, it, expect } from 'vitest';
import { getTokenRefs, pairingWarnings, buildUsageIndex, buildPageUsageIndex } from '../../lab/lib/token-refs.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const raw: Record<string, unknown> = {
  'duration.100': '100ms',
  'duration.300': '300ms',
  'duration.560': '560ms',
  'duration.1200': '1200ms',
  'easing.productive-standard': [0.2, 0, 0.38, 0.9],
  'easing.productive-standard.spring': { bounce: 0, token: 'bounce.0' },
  'easing.expressive-standard': [0.4, 0.1, 0.3, 1],
  'easing.expressive-standard.spring': { bounce: 0, token: 'bounce.0' },
  'easing.expressive-bounce': [0.34, 1.15, 0.64, 1],
  'easing.expressive-bounce.spring': { bounce: 0.25, token: 'bounce.25' },
  'easing.productive-exit': [0.2, 0, 1, 0.9],
  'bounce.0': 0,
  'bounce.25': 0.25,
  'distance.16': '16px',
  'opacity.56': 0.56,
  'delay.70': '70ms',
};

const tweenVersion: MotionVersion = {
  id: 'v1',
  label: 'Fade Up',
  model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-standard', delay: '0ms' },
  keyframes: [],
};

const bounceVersion: MotionVersion = {
  id: 'v2',
  label: 'Bounce In',
  model: {
    model: 'spring',
    duration: 'duration.560',
    easing: 'easing.expressive-bounce',
    properties: [{ property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1, span: 1 }],
  },
};

const flatSpring: MotionVersion = {
  ...bounceVersion,
  id: 'v3',
  label: 'Flat spring',
  model: { ...(bounceVersion.model as object), easing: 'easing.productive-standard', duration: 'duration.300' } as MotionVersion['model'],
};

const hardcodedVersion: MotionVersion = {
  id: 'v4',
  label: 'Hardcoded',
  model: { model: 'tween', duration: '400ms', easing: 'ease-in', delay: '50ms' },
  keyframes: [],
};

describe('getTokenRefs', () => {
  it('lists the duration and easing of a tween', () => {
    expect(getTokenRefs(tweenVersion, raw).tokens).toEqual(['duration.300', 'easing.productive-standard']);
  });

  it('a spring lists its duration, its easing and the easing\'s bounce token', () => {
    expect(getTokenRefs(bounceVersion, raw).tokens).toEqual(['duration.560', 'easing.expressive-bounce', 'bounce.25']);
  });

  it('bounce-0 means no bounce and is never listed', () => {
    const { tokens } = getTokenRefs(flatSpring, raw);
    expect(tokens).toEqual(['duration.300', 'easing.productive-standard']);
    expect(tokens).not.toContain('bounce.0');
  });

  it('lists a stagger that is a delay token, and a delay that is one', () => {
    const v: MotionVersion = { ...tweenVersion, stagger: 'delay.70', model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-standard', delay: 'delay.70' } };
    expect(getTokenRefs(v, raw).tokens).toEqual(['duration.300', 'easing.productive-standard', 'delay.70']);
  });

  it('lists the tokens a tween names in its keyframes', () => {
    const v: MotionVersion = {
      ...tweenVersion,
      keyframes: [
        { opacity: '{opacity.56}', transform: 'translateY({distance.16})', offset: 0 },
        { opacity: 1, transform: 'translateY(-{distance.16})', offset: 1 },
      ],
    };
    expect(getTokenRefs(v, raw).tokens).toEqual(['duration.300', 'easing.productive-standard', 'opacity.56', 'distance.16']);
  });

  it('flags hard-coded values that are not token paths', () => {
    const { hardcoded } = getTokenRefs(hardcodedVersion, raw);
    expect(hardcoded.some(h => h.value === '400ms' && h.label === 'duration')).toBe(true);
    expect(hardcoded.some(h => h.value === 'ease-in')).toBe(true);
    expect(hardcoded.some(h => h.value === '50ms' && h.label === 'delay')).toBe(true);
  });

  it('does not flag zero delay (0ms) as hard-coded', () => {
    expect(getTokenRefs(tweenVersion, raw).hardcoded).toEqual([]);
  });

  it('deduplicates repeated token references', () => {
    const dup: MotionVersion = { ...tweenVersion, model: { model: 'tween', duration: 'duration.300', easing: 'duration.300' } };
    expect(getTokenRefs(dup, raw).tokens.filter(t => t === 'duration.300')).toHaveLength(1);
  });
});

describe('pairingWarnings', () => {
  const tween = (duration: string, easing: string): MotionVersion => ({
    ...tweenVersion,
    model: { model: 'tween', duration, easing },
  });

  it('is quiet for a productive easing at 100–300ms and an expressive easing at 400–1200ms', () => {
    expect(pairingWarnings(tween('duration.100', 'easing.productive-standard'), raw)).toEqual([]);
    expect(pairingWarnings(tween('duration.300', 'easing.productive-standard'), raw)).toEqual([]);
    expect(pairingWarnings(tween('duration.560', 'easing.expressive-standard'), raw)).toEqual([]);
    expect(pairingWarnings(tween('duration.1200', 'easing.expressive-standard'), raw)).toEqual([]);
  });

  it('warns when a productive easing is outside 100–300ms', () => {
    expect(pairingWarnings(tween('duration.560', 'easing.productive-standard'), raw))
      .toEqual(['productive-standard is a productive easing: pair it with 100–300ms, not 560ms']);
    expect(pairingWarnings(tween('50ms', 'easing.productive-exit'), raw)).toHaveLength(1);
  });

  it('warns when an expressive easing is outside 400–1200ms', () => {
    expect(pairingWarnings(tween('duration.300', 'easing.expressive-standard'), raw))
      .toEqual(['expressive-standard is an expressive easing: pair it with 400–1200ms, not 300ms']);
    expect(pairingWarnings(tween('1500ms', 'easing.expressive-standard'), raw)).toHaveLength(1);
  });

  it('a bounce easing is expressive only', () => {
    expect(pairingWarnings(tween('duration.560', 'easing.expressive-bounce'), raw)).toEqual([]);
    const odd = { ...raw, 'easing.productive-bounce': [0, 0, 1, 1], 'easing.productive-bounce.spring': { bounce: 0.25, token: 'bounce.25' } };
    expect(pairingWarnings(tween('duration.300', 'easing.productive-bounce'), odd))
      .toEqual(['productive-bounce has a bounce, so it is for expressive motion only']);
  });

  it('applies to springs too, using the paired duration', () => {
    expect(pairingWarnings(bounceVersion, raw)).toEqual([]);
    const slowFlat: MotionVersion = { ...flatSpring, model: { ...(flatSpring.model as object), duration: 'duration.1200' } as MotionVersion['model'] };
    expect(pairingWarnings(slowFlat, raw)).toHaveLength(1);
  });

  it('says nothing about linear, literals or tokens it does not know', () => {
    expect(pairingWarnings(tween('duration.1200', 'easing.linear'), raw)).toEqual([]);
    expect(pairingWarnings(tween('duration.1200', 'ease-out'), raw)).toEqual([]);
    expect(pairingWarnings(tween('slow', 'easing.productive-standard'), raw)).toEqual([]);
  });
});

describe('buildUsageIndex', () => {
  it('maps token paths to the versions that use them', () => {
    const index = buildUsageIndex([
      { componentName: 'card', version: tweenVersion },
      { componentName: 'card', version: bounceVersion },
    ], raw);
    expect(index.get('duration.300')![0]).toMatchObject({ componentName: 'card', versionId: 'v1' });
    expect(index.get('easing.expressive-bounce')![0]!.versionId).toBe('v2');
    expect(index.get('bounce.25')![0]!.versionId).toBe('v2');
  });

  it('tokens used by multiple versions accumulate entries', () => {
    const other: MotionVersion = { ...tweenVersion, id: 'v1b', model: { model: 'tween', duration: 'duration.300', easing: 'ease' } };
    const entries = buildUsageIndex([
      { componentName: 'card', version: tweenVersion },
      { componentName: 'hero', version: other },
    ], raw).get('duration.300')!;
    expect(entries).toHaveLength(2);
    expect(entries.some(e => e.componentName === 'hero')).toBe(true);
  });

  it('tokens not referenced by any version, and bounce-0, are absent from the index', () => {
    const index = buildUsageIndex([{ componentName: 'card', version: flatSpring }], raw);
    expect(index.has('duration.560')).toBe(false);
    expect(index.has('bounce.0')).toBe(false);
  });

  it('returns an empty map when given no versions', () => {
    expect(buildUsageIndex([], raw).size).toBe(0);
  });

  it('reflects a version added and then removed', () => {
    const before = buildUsageIndex([{ componentName: 'card', version: tweenVersion }], raw);
    expect(before.has('bounce.25')).toBe(false);
    const added = buildUsageIndex([
      { componentName: 'card', version: tweenVersion },
      { componentName: 'card', version: bounceVersion },
    ], raw);
    expect(added.get('bounce.25')).toEqual([{ componentName: 'card', versionId: 'v2', versionLabel: 'Bounce In' }]);
    expect(buildUsageIndex([{ componentName: 'card', version: bounceVersion }], raw).has('easing.productive-standard')).toBe(false);
  });
});

describe('buildPageUsageIndex', () => {
  const defaults = new Map<string, MotionVersion>([['card', tweenVersion], ['hero', bounceVersion]]);

  it('maps tokens to the pages that use them via default versions', () => {
    const pages = [
      { id: 'home', title: 'Home', components: [{ id: 'c1', component: 'card' }] },
      { id: 'about', title: 'About', components: [{ id: 'h1', component: 'hero' }] },
    ];
    const index = buildPageUsageIndex(pages, defaults, raw);
    expect(index.get('duration.300')).toEqual(['home']);
    expect(index.get('easing.productive-standard')).toEqual(['home']);
    expect(index.get('bounce.25')).toEqual(['about']);
  });

  it('lists a page once even when a component appears several times', () => {
    const pages = [{ id: 'home', title: 'Home', components: [{ id: 'c1', component: 'card' }, { id: 'c2', component: 'card' }] }];
    expect(buildPageUsageIndex(pages, defaults, raw).get('duration.300')).toEqual(['home']);
  });

  it('drops a page from a token when its component is removed', () => {
    const page = { id: 'home', title: 'Home', components: [{ id: 'c1', component: 'card' }] };
    expect(buildPageUsageIndex([page], defaults, raw).has('duration.300')).toBe(true);
    expect(buildPageUsageIndex([{ ...page, components: [] }], defaults, raw).has('duration.300')).toBe(false);
  });

  it('ignores components with no registered default version', () => {
    const pages = [{ id: 'home', title: 'Home', components: [{ id: 'x', component: 'missing' }] }];
    expect(buildPageUsageIndex(pages, defaults, raw).size).toBe(0);
  });
});
