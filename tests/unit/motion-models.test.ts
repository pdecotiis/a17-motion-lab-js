import { describe, it, expect } from 'vitest';
import { resolveTiming, resolveKeyframes, springParts, stepsOf, playbackOf, describePlayback, buildAnimationOptions, buildSpringWaapiKeyframes, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { SPRING_DURATION_RATIO } from '../../lab/lib/spring-engine.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const raw: Record<string, unknown> = {
  'duration.300': '300ms',
  'duration.140': '140ms',
  'easing.ease-out': [0.0, 0.0, 0.2, 1.0],
  'easing.exit': [0.4, 0, 1, 1],
  'easing.settle': [0.34, 1.06, 0.64, 1],
  'easing.ease-out.spring': { bounce: 0, token: 'bounce.0' },
  'easing.settle.spring': { bounce: 0.1, token: 'bounce.10' },
  'easing.bounce': [0.34, 1.15, 0.64, 1],
  'easing.bounce.spring': { bounce: 0.25, token: 'bounce.25' },
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
      { property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1, span: 1, useSpring: true },
      { property: 'opacity', from: 0, to: 1, span: 1, useSpring: false },
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

describe('buildSpringWaapiKeyframes - spring', () => {
  it('produces a WAAPI keyframe array from the spring simulation', () => {
    const { keyframes } = buildSpringWaapiKeyframes(springVersion, raw);
    expect(Array.isArray(keyframes)).toBe(true);
    // Real spring should produce many more frames than just 2
    expect(keyframes.length).toBeGreaterThan(2);
  });

  it('produces a positive numeric duration (actual spring settle time)', () => {
    const { duration } = buildSpringWaapiKeyframes(springVersion, raw);
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThan(0);
  });

  it('first keyframe starts at from values', () => {
    const { keyframes } = buildSpringWaapiKeyframes(springVersion, raw);
    const first = keyframes[0]!;
    expect(first.transform).toContain('scale(0.92)');
    expect(first.opacity).toBe(0);
  });

  it('last keyframe ends at to values', () => {
    const { keyframes } = buildSpringWaapiKeyframes(springVersion, raw);
    const last = keyframes[keyframes.length - 1]!;
    expect(last.transform).toContain('scale(1)');
    expect(last.opacity).toBe(1);
  });

  it('respects playbackRate — halving rate doubles duration', () => {
    const { duration: d1 } = buildSpringWaapiKeyframes(springVersion, raw, { playbackRate: 1 });
    const { duration: d2 } = buildSpringWaapiKeyframes(springVersion, raw, { playbackRate: 0.5 });
    expect(d2).toBeCloseTo(d1 * 2, 0);
  });

  it('reduced motion: skips transform travel, keeps opacity fade with short duration', () => {
    const { keyframes, duration } = buildSpringWaapiKeyframes(springVersion, raw, {
      reducedMotion: true,
    });
    // Transform should be snapped to end position (no travel)
    for (const kf of keyframes) {
      if (kf.transform !== undefined) {
        expect(kf.transform).toContain('scale(1)');
      }
    }
    // Opacity should animate
    const opacities = keyframes.map(kf => kf.opacity).filter(v => v !== undefined);
    expect(opacities.length).toBeGreaterThan(0);
    // Duration should be short (≤150ms)
    expect(duration).toBeLessThanOrEqual(150);
  });

  it('throws when called on a tween version', () => {
    expect(() => buildSpringWaapiKeyframes(tweenVersion, raw)).toThrow('not a spring model');
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

describe('springs are a view of easing', () => {
  const settle = (over: Partial<MotionVersion['model']> = {}): MotionVersion => ({
    ...springVersion,
    model: { ...(springVersion.model as object), easing: 'easing.settle', ...over } as MotionVersion['model'],
  });

  it('springParts takes the bounce from the easing and derives the spring duration as duration / 0.82', () => {
    const parts = springParts(springVersion.model as never, raw);
    expect(parts.bounce).toBe(0);
    expect(parts.pairedMs).toBe(300);
    expect(parts.durationMs).toBeCloseTo(300 / 0.82, 6);
    expect(SPRING_DURATION_RATIO).toBe(0.82);
    expect(parts.bounceToken).toBe('bounce.0');
  });

  it('another easing gives another bounce, over the same derived duration', () => {
    const parts = springParts(settle().model as never, raw);
    expect(parts).toMatchObject({ bounce: 0.1, bounceToken: 'bounce.10' });
    expect(parts.durationMs).toBeCloseTo(300 / 0.82, 6);
  });

  it('the duration can be a literal; a different duration token changes the derived duration', () => {
    expect(springParts(settle({ duration: '410ms' }).model as never, raw).durationMs).toBeCloseTo(500, 6);
    expect(springParts(settle({ duration: 'duration.140' }).model as never, raw).durationMs).toBeCloseTo(140 / 0.82, 6);
  });

  it("an easing with no spring form can't be a spring: exits, linear and literals throw a clear error", () => {
    expect(() => springParts(settle({ easing: 'easing.exit' }).model as never, raw)).toThrow('has no spring form');
    expect(() => springParts(settle({ easing: 'ease-in' }).model as never, raw)).toThrow('has no spring form');
  });

  it('a bounce above 0 overshoots; bounce-0 does not', () => {
    const grow = (easing: string): MotionVersion =>
      settle({ easing, properties: [{ property: 'transform', wrapTransform: 'scale', from: 0, to: 1, span: 1, useSpring: true }] } as never);
    const peak = (v: MotionVersion): number =>
      Math.max(...buildSpringWaapiKeyframes(v, raw).keyframes.map(kf => parseFloat(String(kf.transform).replace('scale(', ''))));
    expect(peak(grow('easing.ease-out'))).toBeLessThanOrEqual(1);
    expect(peak(grow('easing.bounce'))).toBeGreaterThan(1);
  });

  it('validates with a duration and an easing; rejects a spring without either', () => {
    expect(() => validateMotionVersion(settle())).not.toThrow();
    expect(() => validateMotionVersion(settle({ easing: undefined as never }))).toThrow(/needs a duration and an easing/);
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
    expect(buildSpringWaapiKeyframes(stepsOf(v)[1]!.version, raw).keyframes.length).toBeGreaterThan(2);
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

describe('the playback lens: playbackOf', () => {
  const withEasing = (v: MotionVersion, easing: string, duration = 'duration.300'): MotionVersion =>
    ({ ...v, model: { ...(v.model as object), easing, duration } as MotionVersion['model'] });
  const spring = (p: ReturnType<typeof playbackOf>): number => p.springMs!;

  describe('a tween', () => {
    it('as easing plays its keyframes over the duration, with the easing curve', () => {
      const p = playbackOf(tweenVersion, raw, 'easing');
      expect(p).toMatchObject({ as: 'easing', duration: 300, delay: 0, easing: 'cubic-bezier(0, 0, 0.2, 1)', pairedMs: 300 });
      expect(p.keyframes).toEqual(tweenVersion.keyframes);
      expect(p.note).toBeUndefined();
    });

    it('as a spring plays the same keyframes with the easing\'s spring as the timing function', () => {
      const p = playbackOf(tweenVersion, raw, 'spring');
      expect(p.as).toBe('spring');
      expect(p.keyframes).toEqual(tweenVersion.keyframes);
      expect(p.easing).toMatch(/^linear\(0,/);
      expect(p).toMatchObject({ bounce: 0, bounceToken: 'bounce.0', pairedMs: 300 });
      expect(spring(p)).toBeCloseTo(300 / 0.82, 6);
    });

    it('lasts until the spring settles, not its nominal duration', () => {
      const p = playbackOf(withEasing(tweenVersion, 'easing.settle'), raw, 'spring');
      expect(p.duration).toBeGreaterThan(0);
      expect(p.duration).not.toBe(300);
    });

    it('takes the bounce of the easing: settle bounces, so its curve overshoots 1', () => {
      const flat = playbackOf(tweenVersion, raw, 'spring');
      const settle = playbackOf(withEasing(tweenVersion, 'easing.settle'), raw, 'spring');
      expect(settle).toMatchObject({ bounce: 0.1, bounceToken: 'bounce.10' });
      const peak = (easing: string): number => Math.max(...[...easing.matchAll(/(-?[\d.]+)(?: [\d.]+%)?(?=[,)])/g)].map(m => Number(m[1])));
      expect(peak(flat.easing)).toBeLessThanOrEqual(1);
      expect(peak(settle.easing)).toBeGreaterThan(1);
    });

    it('an easing with no spring form (an exit, linear, a literal) plays as easing, with a note', () => {
      for (const easing of ['easing.exit', 'ease-in']) {
        const p = playbackOf(withEasing(tweenVersion, easing), raw, 'spring');
        expect(p.as).toBe('easing');
        expect(p.easing).not.toMatch(/^linear\(/);
        expect(p.note).toMatch(/has no spring form, so it plays as easing/);
      }
    });

    it('the lens only matters under spring: easing never has a note', () => {
      expect(playbackOf(withEasing(tweenVersion, 'easing.exit'), raw, 'easing').note).toBeUndefined();
    });
  });

  describe('a spring version', () => {
    it('as a spring plays its physics: baked keyframes on a linear timing function', () => {
      const p = playbackOf(springVersion, raw, 'spring');
      expect(p).toMatchObject({ as: 'spring', easing: 'linear', bounce: 0, bounceToken: 'bounce.0' });
      expect(p.keyframes.length).toBeGreaterThan(2);
      expect(spring(p)).toBeCloseTo(300 / 0.82, 6);
    });

    it('as easing plays its from and to values with the easing curve over the duration', () => {
      const p = playbackOf(springVersion, raw, 'easing');
      expect(p).toMatchObject({ as: 'easing', duration: 300, easing: 'cubic-bezier(0, 0, 0.2, 1)' });
      expect(p.springMs).toBeUndefined();
      expect(p.keyframes).toEqual([
        { offset: 0, transform: 'scale(0.92)', opacity: 0 },
        { offset: 1, transform: 'scale(1)', opacity: 1 },
      ]);
    });

    it('as easing works for an easing with no spring form, since it is not a spring', () => {
      expect(playbackOf(withEasing(springVersion, 'easing.exit'), raw, 'easing').as).toBe('easing');
    });
  });

  describe('timing', () => {
    it('the playback rate scales duration and delay, under either lens', () => {
      const delayed: MotionVersion = { ...tweenVersion, model: { model: 'tween', duration: 'duration.300', easing: 'easing.ease-out', delay: 'delay.70' } };
      expect(playbackOf(delayed, raw, 'easing', { playbackRate: 2 })).toMatchObject({ duration: 150, delay: 35 });
      const slow = playbackOf(delayed, raw, 'spring', { playbackRate: 0.5 });
      const normal = playbackOf(delayed, raw, 'spring');
      expect(slow.duration).toBeCloseTo(normal.duration * 2, 6);
      expect(slow.delay).toBe(140);
    });

    it('another duration token changes the spring too: shorter duration, shorter spring', () => {
      const quick = playbackOf(withEasing(tweenVersion, 'easing.ease-out', 'duration.140'), raw, 'spring');
      expect(spring(quick)).toBeCloseTo(140 / 0.82, 6);
      expect(quick.duration).toBeLessThan(playbackOf(tweenVersion, raw, 'spring').duration);
    });
  });

  describe('reduced motion', () => {
    it('is the short opacity-only fade under either lens, and for either kind of version', () => {
      for (const v of [tweenVersion, springVersion]) {
        for (const mode of ['easing', 'spring'] as const) {
          const p = playbackOf(v, raw, mode, { reducedMotion: true });
          expect(p.duration, `${v.id} ${mode}`).toBeLessThanOrEqual(150);
          for (const kf of p.keyframes) expect(Object.keys(kf).filter(k => k !== 'offset')).toEqual(['opacity']);
        }
      }
    });

    it('a spring lens uses a linear timing function for the fade; easing keeps its curve', () => {
      expect(playbackOf(tweenVersion, raw, 'spring', { reducedMotion: true }).easing).toBe('linear');
      expect(playbackOf(tweenVersion, raw, 'easing', { reducedMotion: true }).easing).toBe('cubic-bezier(0, 0, 0.2, 1)');
    });
  });

  describe('describePlayback', () => {
    it('says what plays, in a line', () => {
      expect(describePlayback(playbackOf(tweenVersion, raw, 'easing'))).toBe('Easing · ease-out, 300ms');
      expect(describePlayback(playbackOf(tweenVersion, raw, 'spring'))).toBe('Spring · ease-out, bounce 0, 366ms');
      expect(describePlayback(playbackOf(withEasing(tweenVersion, 'easing.settle'), raw, 'spring')))
        .toBe('Spring · settle, bounce 0.1 (bounce.10), 366ms');
    });

    it('adds why, when a spring was asked for and the easing has none', () => {
      expect(describePlayback(playbackOf(withEasing(tweenVersion, 'easing.exit'), raw, 'spring')))
        .toBe('Easing · exit, 300ms (exit has no spring form, so it plays as easing)');
    });
  });
});
