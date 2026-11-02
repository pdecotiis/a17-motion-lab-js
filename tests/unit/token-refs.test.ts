import { describe, it, expect } from 'vitest';
import { getTokenRefs, getStepRefs, pairingWarnings, buildUsageIndex, buildPageUsageIndex } from '../../lab/lib/token-refs.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const raw: Record<string, unknown> = {
  'duration.100': '100ms',
  'duration.300': '300ms',
  'duration.560': '560ms',
  'duration.1200': '1200ms',
  'easing.productive-standard': [0.2, 0, 0.38, 0.9],
  'easing.expressive-standard': [0.4, 0.1, 0.3, 1],
  'easing.expressive-entrance': [0.34, 1.15, 0.64, 1],
  'easing.productive-exit': [0.2, 0, 1, 0.9],
  'distance.16': '16px',
  'opacity.56': 0.56,
  'delay.70': '70ms',
  'bounce.0': 0,
  'bounce.25': 0.25,
  'bounce.50': 0.5,
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
    easing: 'easing.expressive-entrance',
    bounce: 0.25,
    properties: [{ property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1 }],
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

  it('a spring lists its duration and easing', () => {
    expect(getTokenRefs(bounceVersion, raw).tokens).toEqual(['duration.560', 'easing.expressive-entrance']);
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

  it('there are no pairing warnings under Motion: nothing plays an easing', () => {
    const slow = tween('duration.1200', 'easing.productive-standard');
    expect(pairingWarnings(slow, raw, 'css')).toHaveLength(1);
    expect(pairingWarnings(slow, raw, 'motion')).toEqual([]);
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
    expect(index.get('easing.expressive-entrance')![0]!.versionId).toBe('v2');
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

  it('tokens not referenced by any version are absent from the index', () => {
    const index = buildUsageIndex([{ componentName: 'card', version: flatSpring }], raw);
    expect(index.has('duration.560')).toBe(false);
  });

  it('returns an empty map when given no versions', () => {
    expect(buildUsageIndex([], raw).size).toBe(0);
  });

  it('reflects a version added and then removed', () => {
    const before = buildUsageIndex([{ componentName: 'card', version: tweenVersion }], raw);
    expect(before.has('easing.expressive-entrance')).toBe(false);
    const added = buildUsageIndex([
      { componentName: 'card', version: tweenVersion },
      { componentName: 'card', version: bounceVersion },
    ], raw);
    expect(added.get('easing.expressive-entrance')).toEqual([{ componentName: 'card', versionId: 'v2', versionLabel: 'Bounce In' }]);
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
    expect(index.get('easing.expressive-entrance')).toEqual(['about']);
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

describe('getStepRefs: which tokens are used where', () => {
  const keyframed: MotionVersion = {
    ...tweenVersion,
    stagger: 'delay.70',
    model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-standard', delay: 'delay.70' },
    keyframes: [
      { opacity: '{opacity.56}', transform: 'translateY({distance.16})', offset: 0 },
      { opacity: 1, transform: 'translateY(-{distance.16})', offset: 1 },
    ],
  };

  it('says where each token sits in the motion: duration, easing, delay, stagger, a keyframe property', () => {
    expect(getStepRefs(keyframed, raw)).toEqual([{
      layer: null,
      uses: [
        { token: 'duration.300', where: ['duration'] },
        { token: 'easing.productive-standard', where: ['easing'] },
        { token: 'delay.70', where: ['delay', 'stagger'] },
        { token: 'opacity.56', where: ['0% opacity'] },
        { token: 'distance.16', where: ['0% transform', '100% transform'] },
      ],
      hardcoded: [],
    }]);
  });

  it('a spring lists its duration and easing', () => {
    expect(getStepRefs(bounceVersion, raw)[0]!.uses).toEqual([
      { token: 'duration.560', where: ['duration'] },
      { token: 'easing.expressive-entrance', where: ['easing'] },
    ]);
  });

  it('under Motion nothing lists an easing: every motion is a spring, from its duration', () => {
    expect(getStepRefs(bounceVersion, raw, 'motion')[0]!.uses).toEqual([{ token: 'duration.560', where: ['duration'] }]);
    expect(getStepRefs(tweenVersion, raw, 'motion')[0]!.uses.map(u => u.token)).toEqual(['duration.300']);
    for (const v of [bounceVersion, tweenVersion]) {
      expect(getStepRefs(v, raw, 'css')[0]!.uses.map(u => u.token), v.id).toContain(v.model.easing);
      expect(getStepRefs(v, raw)[0]!.uses.map(u => u.token), v.id).toContain(v.model.easing);
    }
  });

  it('under Motion a literal easing is not flagged as hard-coded, since no easing plays', () => {
    const literal: MotionVersion = { ...tweenVersion, model: { model: 'tween', duration: 'duration.300', easing: 'ease-out' } };
    expect(getStepRefs(literal, raw, 'css')[0]!.hardcoded).toEqual([{ label: 'easing', value: 'ease-out' }]);
    expect(getStepRefs(literal, raw, 'motion')[0]!.hardcoded).toEqual([]);
  });

  it('under Motion layers list no easing either', () => {
    const layered: MotionVersion = { ...bounceVersion, layers: { text: { model: tweenVersion.model, keyframes: [] } } };
    const steps = getStepRefs(layered, raw, 'motion');
    expect(steps[0]!.uses.map(u => u.token)).toEqual(['duration.560']);
    expect(steps[1]!.uses.map(u => u.token)).toEqual(['duration.300']);
  });

  it('under Motion every motion lists a bounce: its own token, else the global setting', () => {
    const tokenSpring: MotionVersion = { ...bounceVersion, model: { ...(bounceVersion.model as object), bounce: 'bounce.50' } as MotionVersion['model'] };
    expect(getStepRefs(tokenSpring, raw, 'motion', 'bounce.25')[0]!.uses).toEqual([
      { token: 'duration.560', where: ['duration'] },
      { token: 'bounce.50', where: ['bounce'] },
    ]);
    expect(getStepRefs(tweenVersion, raw, 'motion', 'bounce.25')[0]!.uses).toEqual([
      { token: 'duration.300', where: ['duration'] },
      { token: 'bounce.25', where: ['bounce'] },
    ]);
    expect(getStepRefs(tweenVersion, raw, 'motion', 'bounce.0')[0]!.uses.map(u => u.token)).toEqual(['duration.300', 'bounce.0']);
  });

  it('under Motion a plain-number bounce is hard-coded, not a token', () => {
    expect(getStepRefs(bounceVersion, raw, 'motion', 'bounce.25')[0]!.hardcoded).toEqual([{ label: 'bounce', value: '0.25' }]);
    expect(getStepRefs(bounceVersion, raw, 'css')[0]!.hardcoded).toEqual([]);
  });

  it('under CSS no bounce is listed; as authored only a spring\'s own bounce token is', () => {
    const tokenSpring: MotionVersion = { ...bounceVersion, model: { ...(bounceVersion.model as object), bounce: 'bounce.50' } as MotionVersion['model'] };
    expect(getStepRefs(tokenSpring, raw, 'css')[0]!.uses.map(u => u.token)).toEqual(['duration.560', 'easing.expressive-entrance']);
    expect(getStepRefs(tokenSpring, raw)[0]!.uses.map(u => u.token)).toEqual(['duration.560', 'easing.expressive-entrance', 'bounce.50']);
    expect(getStepRefs(tweenVersion, raw)[0]!.uses.map(u => u.token)).toEqual(['duration.300', 'easing.productive-standard']);
  });

  it('keyframes with no offset are placed evenly', () => {
    const v: MotionVersion = {
      ...tweenVersion,
      keyframes: [{ transform: 'translateY({distance.16})' }, { transform: 'translateY(8px)' }, { opacity: '{opacity.56}' }],
    };
    expect(getStepRefs(v, raw)[0]!.uses).toContainEqual({ token: 'distance.16', where: ['0% transform'] });
    expect(getStepRefs(v, raw)[0]!.uses).toContainEqual({ token: 'opacity.56', where: ['100% opacity'] });
  });

  describe('with layers', () => {
    const layered: MotionVersion = {
      ...tweenVersion,
      stagger: 'delay.70',
      keyframes: [{ transform: 'translateY({distance.16})', offset: 0 }, { transform: 'translateY(0px)', offset: 1 }],
      layers: {
        text: {
          model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-standard', delay: 'delay.70' },
          keyframes: [{ opacity: '{opacity.56}', offset: 0 }, { opacity: 1, offset: 1 }],
        },
        badge: { model: { model: 'tween', duration: '240ms', easing: 'easing.productive-exit' }, keyframes: [] },
      },
    };

    it('lists the root first and then each layer, each with its own tokens', () => {
      const steps = getStepRefs(layered, raw);
      expect(steps.map(s => s.layer)).toEqual([null, 'text', 'badge']);
      expect(steps[0]!.uses.map(u => u.token)).toEqual(['duration.300', 'easing.productive-standard', 'delay.70', 'distance.16']);
      expect(steps[1]!.uses.map(u => u.token)).toEqual(['duration.100', 'easing.productive-standard', 'delay.70', 'opacity.56']);
      expect(steps[2]!.uses.map(u => u.token)).toEqual(['easing.productive-exit']);
    });

    it('the stagger belongs to the version, so only the root lists it', () => {
      const steps = getStepRefs(layered, raw);
      expect(steps[0]!.uses.find(u => u.token === 'delay.70')!.where).toEqual(['stagger']);
      expect(steps[1]!.uses.find(u => u.token === 'delay.70')!.where).toEqual(['delay']);
      expect(steps.slice(1).some(st => st.uses.some(u => u.where.includes('stagger')))).toBe(false);
    });

    it('a layer\'s hard-coded value is its own, and the version-wide list names the layer', () => {
      const steps = getStepRefs(layered, raw);
      expect(steps[2]!.hardcoded).toEqual([{ label: 'duration', value: '240ms' }]);
      expect(steps[0]!.hardcoded).toEqual([]);
      expect(getTokenRefs(layered, raw).hardcoded).toEqual([{ label: 'badge duration', value: '240ms' }]);
    });

    it('getTokenRefs is every token across the root and the layers, once each', () => {
      expect(getTokenRefs(layered, raw).tokens).toEqual([
        'duration.300', 'easing.productive-standard', 'delay.70', 'distance.16', 'duration.100', 'opacity.56', 'easing.productive-exit',
      ]);
    });

    it('the usage index counts a layer\'s tokens as used by the version', () => {
      const index = buildUsageIndex([{ componentName: 'card', version: layered }], raw);
      expect(index.get('opacity.56')![0]).toMatchObject({ componentName: 'card', versionId: 'v1' });
      expect(index.get('duration.100')).toHaveLength(1);
    });

    it('pairing warnings cover the layers, led by the layer\'s name', () => {
      const slow: MotionVersion = {
        ...layered,
        layers: { text: { model: { model: 'tween', duration: 'duration.1200', easing: 'easing.productive-standard' }, keyframes: [] } },
      };
      expect(pairingWarnings(slow, raw)).toEqual(['text: productive-standard is a productive easing: pair it with 100–300ms, not 1200ms']);
      expect(pairingWarnings(layered, raw)).toEqual([]);
    });
  });
});

