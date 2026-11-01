import { describe, it, expect } from 'vitest';
import { resolveTiming, resolveKeyframes, springParts, buildAnimationOptions, buildSpringWaapiKeyframes, validateMotionVersion } from '../../lab/lib/motion-models.js';
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
    const t = resolveTiming(tweenVersion, raw, {}, 2);
    expect(t.duration).toBe(150);
  });

  it('live controls override token values', () => {
    const t = resolveTiming(tweenVersion, raw, { duration: '500ms', easing: 'linear' });
    expect(t.duration).toBe(500);
    expect(t.easing).toBe('linear');
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

  it('live control overrides spring natural duration', () => {
    const { duration: original } = buildSpringWaapiKeyframes(springVersion, raw);
    const { duration: overridden } = buildSpringWaapiKeyframes(springVersion, raw, {
      controls: { duration: '200ms' },
    });
    expect(overridden).not.toBeCloseTo(original, -1);
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

  it('a live preview duration is the paired duration, so the spring is that / 0.82', () => {
    const base = buildSpringWaapiKeyframes(springVersion, raw);
    const quick = buildSpringWaapiKeyframes(springVersion, raw, { controls: { duration: '140ms' } });
    expect(quick.duration).toBeLessThan(base.duration);
  });

  it('a live preview bounce overrides the easing\'s', () => {
    const flat = buildSpringWaapiKeyframes(springVersion, raw);
    const bouncy = buildSpringWaapiKeyframes(springVersion, raw, { controls: { bounce: 0.25 } });
    expect(bouncy.keyframes.length).not.toBe(flat.keyframes.length);
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
