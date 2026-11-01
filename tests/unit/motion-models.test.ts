import { describe, it, expect } from 'vitest';
import { resolveTiming, resolveKeyframes, stepsOf, playbackOf, describePlayback, buildAnimationOptions, validateMotionVersion } from '../../lab/lib/motion-models.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const raw: Record<string, unknown> = {
  'duration.300': '300ms',
  'duration.140': '140ms',
  'easing.ease-out': [0.0, 0.0, 0.2, 1.0],
  'easing.exit': [0.4, 0, 1, 1],
  'easing.settle': [0.34, 1.06, 0.64, 1],
  'easing.bounce': [0.34, 1.15, 0.64, 1],
  'distance.16': '16px',
  'delay.70': '70ms',
};

const tweenVersion: MotionVersion = {
  id: 'v1',
  label: 'Fade Up',
  model: { model: 'tween', duration: 'duration.300', easing: 'easing.ease-out', delay: '0ms' },
  keyframes: [
    { opacity: 0, transform: 'translateY(16px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
};

const springVersion: MotionVersion = {
  id: 'v2',
  label: 'Scale In',
  model: {
    model: 'spring',
    duration: 'duration.300',
    easing: 'easing.ease-out',
    properties: [
      { property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1 },
      { property: 'opacity', from: 0, to: 1 },
    ],
  },
};

describe('resolveTiming - tween', () => {
  it('produces numeric duration', () => {
    const t = resolveTiming(tweenVersion, raw);
    expect(typeof t.duration).toBe('number');
    expect(t.duration).toBe(300);
  });

  it('produces cubic-bezier easing string', () => {
    const t = resolveTiming(tweenVersion, raw);
    expect(t.easing).toContain('cubic-bezier');
  });

  it('respects playbackRate', () => {
    const t = resolveTiming(tweenVersion, raw, 2);
    expect(t.duration).toBe(150);
  });

  it('throws when called on a spring version', () => {
    expect(() => resolveTiming(springVersion, raw)).toThrow('spring model');
  });
});

describe('buildAnimationOptions', () => {
  it('returns valid KeyframeAnimationOptions', () => {
    const timing = resolveTiming(tweenVersion, raw);
    const opts = buildAnimationOptions(timing);
    expect(typeof opts.duration).toBe('number');
    expect(typeof opts.easing).toBe('string');
    expect(opts.fill).toBe('both');
  });
});

describe('validateMotionVersion', () => {
  it('accepts valid tween version', () => {
    expect(() => validateMotionVersion(tweenVersion)).not.toThrow();
  });

  it('accepts valid spring version', () => {
    expect(() => validateMotionVersion(springVersion)).not.toThrow();
  });

  it('rejects structural properties in tween keyframes', () => {
    const bad: MotionVersion = {
      ...tweenVersion,
      keyframes: [{ display: 'none' }],
    };
    expect(() => validateMotionVersion(bad)).toThrow('structural property');
  });

  it('rejects spring version with empty properties array', () => {
    const bad: MotionVersion = {
      ...springVersion,
      model: { ...springVersion.model as any, properties: [] },
    };
    expect(() => validateMotionVersion(bad)).toThrow('properties array');
  });

  it('rejects unknown top-level properties', () => {
    const bad = { ...tweenVersion, innerHTML: '<script>' } as unknown as MotionVersion;
    expect(() => validateMotionVersion(bad)).toThrow('disallowed property');
  });
});

describe('a spring version', () => {
  it('validates with a duration and an easing; rejects a spring without either', () => {
    expect(() => validateMotionVersion(springVersion)).not.toThrow();
    expect(() => validateMotionVersion({ ...springVersion, model: { ...(springVersion.model as object), easing: undefined } as never })).toThrow(/needs a duration and an easing/);
    expect(() => validateMotionVersion({ ...tweenVersion, model: { model: 'tween', duration: 'duration.300' } as never })).toThrow(/needs a duration and an easing/);
  });
});

describe('references in keyframes', () => {
  const kfVersion: MotionVersion = {
    ...tweenVersion,
    keyframes: [
      { opacity: 0, transform: 'translateY({distance.16})', offset: 0 },
      { opacity: 1, transform: 'translateY(-{distance.16})', offset: 1 },
    ],
  };

  it('resolveKeyframes replaces token references and leaves everything else alone', () => {
    expect(resolveKeyframes(kfVersion.keyframes, raw)).toEqual([
      { opacity: 0, transform: 'translateY(16px)', offset: 0 },
      { opacity: 1, transform: 'translateY(-16px)', offset: 1 },
    ]);
    expect(resolveKeyframes(undefined, raw)).toEqual([]);
  });

  it('an unknown reference throws', () => {
    expect(() => resolveKeyframes([{ transform: 'translateY({distance.99})' }], raw)).toThrow('Unknown token reference');
  });

  it('keyframes with references still validate', () => {
    expect(() => validateMotionVersion(kfVersion)).not.toThrow();
  });
});

describe('layers', () => {
  const step = (over: Record<string, unknown> = {}) => ({
    model: { model: 'tween' as const, duration: 'duration.300', easing: 'easing.ease-out', ...over },
    keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  });
  const layered: MotionVersion = {
    ...tweenVersion,
    stagger: 'delay.70',
    layers: { title: step({ delay: 'delay.70' }), text: step({ duration: 'duration.140' }) },
  };

  it('stepsOf lists the root first, then each layer by name, each as a version of its own', () => {
    const steps = stepsOf(layered);
    expect(steps.map(s => s.name)).toEqual([null, 'title', 'text']);
    expect(steps[0]!.version.model).toBe(tweenVersion.model);
    expect(steps[1]!.version.model).toMatchObject({ delay: 'delay.70' });
    expect(steps[2]!.version.model).toMatchObject({ duration: 'duration.140' });
  });

  it('a layer shares the version\'s stagger, trigger and reduced-motion policy, and has no layers of its own', () => {
    const v: MotionVersion = { ...layered, trigger: { on: 'load' }, reducedMotion: 'none' };
    for (const s of stepsOf(v)) {
      expect(s.version.stagger).toBe('delay.70');
      expect(s.version.trigger).toEqual({ on: 'load' });
      expect(s.version.reducedMotion).toBe('none');
      expect(s.version.layers).toBeUndefined();
    }
  });

  it('a version with no layers has just the root', () => {
    expect(stepsOf(tweenVersion).map(s => s.name)).toEqual([null]);
  });

  it('each layer times itself', () => {
    const [, title, text] = stepsOf(layered);
    expect(resolveTiming(title!.version, raw).delay).toBe(70);
    expect(resolveTiming(text!.version, raw).duration).toBe(140);
  });

  it('a layer can be a spring', () => {
    const v: MotionVersion = { ...tweenVersion, layers: { badge: { model: springVersion.model } } };
    expect(playbackOf(stepsOf(v)[1]!.version, raw).keyframes).toHaveLength(2);
  });

  it('validates a version with layers', () => {
    expect(() => validateMotionVersion(layered)).not.toThrow();
  });

  it('rejects a layer name that is not a data-motion value', () => {
    expect(() => validateMotionVersion({ ...tweenVersion, layers: { 'Page Title': step() } })).toThrow(/layer name "Page Title"/);
    expect(() => validateMotionVersion({ ...tweenVersion, layers: { '': step() } })).toThrow(/layer name/);
  });

  it('checks a layer like the root, and names the layer in the error', () => {
    const noEasing = { model: { model: 'tween' as const, duration: 'duration.300' } } as never;
    expect(() => validateMotionVersion({ ...tweenVersion, layers: { text: noEasing } })).toThrow(/needs a duration and an easing.*layer "text"/);
    const structural = { ...step(), keyframes: [{ display: 'none' }] };
    expect(() => validateMotionVersion({ ...tweenVersion, layers: { text: structural } })).toThrow(/structural property.*layer "text"/);
  });
});

describe('playbackOf (the CSS runtime)', () => {
  const withEasing = (v: MotionVersion, easing: string, duration = 'duration.300'): MotionVersion =>
    ({ ...v, model: { ...(v.model as object), easing, duration } as MotionVersion['model'] });

  describe('a tween', () => {
    it('plays its keyframes over the duration, with the easing curve', () => {
      const p = playbackOf(tweenVersion, raw);
      expect(p).toMatchObject({ duration: 300, delay: 0, easing: 'cubic-bezier(0, 0, 0.2, 1)', pairedMs: 300 });
      expect(p.keyframes).toEqual(tweenVersion.keyframes);
      expect(p.note).toBeUndefined();
    });

    it('never simulates a spring: any easing, even one with a spring form, plays as its curve', () => {
      const p = playbackOf(withEasing(tweenVersion, 'easing.settle'), raw);
      expect(p.easing).toBe('cubic-bezier(0.34, 1.06, 0.64, 1)');
      expect(p.duration).toBe(300);
      expect(p.note).toBeUndefined();
    });
  });

  describe('a spring version', () => {
    it('plays its from and to values with the easing curve over the duration', () => {
      const p = playbackOf(springVersion, raw);
      expect(p).toMatchObject({ duration: 300, easing: 'cubic-bezier(0, 0, 0.2, 1)' });
      expect(p.keyframes).toEqual([
        { offset: 0, transform: 'scale(0.92)', opacity: 0 },
        { offset: 1, transform: 'scale(1)', opacity: 1 },
      ]);
    });

    it('says it was authored as a spring', () => {
      expect(playbackOf(springVersion, raw).note).toMatch(/authored as a spring/);
    });
  });

  describe('timing', () => {
    it('the playback rate scales duration and delay', () => {
      const delayed: MotionVersion = { ...tweenVersion, model: { model: 'tween', duration: 'duration.300', easing: 'easing.ease-out', delay: 'delay.70' } };
      expect(playbackOf(delayed, raw, { playbackRate: 2 })).toMatchObject({ duration: 150, delay: 35 });
    });

    it('another duration token changes the duration', () => {
      expect(playbackOf(withEasing(tweenVersion, 'easing.ease-out', 'duration.140'), raw).duration).toBe(140);
    });
  });

  describe('reduced motion', () => {
    it('is the short opacity-only fade, for either kind of version', () => {
      for (const v of [tweenVersion, springVersion]) {
        const p = playbackOf(v, raw, { reducedMotion: true });
        expect(p.duration, v.id).toBeLessThanOrEqual(150);
        for (const kf of p.keyframes) expect(Object.keys(kf).filter(k => k !== 'offset')).toEqual(['opacity']);
      }
    });

    it('keeps the easing curve', () => {
      expect(playbackOf(tweenVersion, raw, { reducedMotion: true }).easing).toBe('cubic-bezier(0, 0, 0.2, 1)');
    });
  });

  describe('describePlayback', () => {
    it('says what plays, in a line', () => {
      expect(describePlayback(playbackOf(tweenVersion, raw))).toBe('Easing · ease-out, 300ms');
      expect(describePlayback(playbackOf(springVersion, raw)))
        .toBe('Easing · ease-out, 300ms (authored as a spring; CSS plays its easing)');
    });
  });
});
