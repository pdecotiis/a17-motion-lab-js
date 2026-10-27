import { describe, it, expect } from 'vitest';
import { resolveTiming, buildAnimationOptions, buildSpringWaapiKeyframes, validateMotionVersion } from '../../lab/lib/motion-models.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const raw: Record<string, unknown> = {
  'motion.timings.base': '300ms',
  'motion.easings.ease-out': [0.0, 0.0, 0.2, 1.0],
  'motion.springs.bouncy': { bounce: 0.4, duration: 600 },
};

const tweenVersion: MotionVersion = {
  id: 'v1',
  label: 'Fade Up',
  model: { model: 'tween', duration: 'motion.timings.base', easing: 'motion.easings.ease-out', delay: '0ms' },
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
    bounce: 0.4,
    duration: 'motion.springs.bouncy',
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
