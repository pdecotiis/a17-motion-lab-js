import { describe, it, expect } from 'vitest';
import { resolveTiming, buildAnimationOptions, validateMotionVersion } from '../../lab/lib/motion-models.js';
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
  model: { model: 'spring', bounce: 0.4, duration: 'motion.springs.bouncy' },
  keyframes: [
    { opacity: 0, transform: 'scale(0.92)' },
    { opacity: 1, transform: 'scale(1)' },
  ],
};

describe('resolveTiming - tween', () => {
  it('produces numeric duration', () => {
    const t = resolveTiming(tweenVersion, raw);
    expect(typeof t.duration).toBe('number');
    expect(t.duration).toBe(300);
  });

  it('produces easing string', () => {
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
});

describe('resolveTiming - spring', () => {
  it('produces numeric duration', () => {
    const t = resolveTiming(springVersion, raw);
    expect(typeof t.duration).toBe('number');
    expect(t.duration).toBeGreaterThan(0);
  });

  it('produces easing string', () => {
    const t = resolveTiming(springVersion, raw);
    expect(t.easing).toContain('cubic-bezier');
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
  it('accepts valid versions', () => {
    expect(() => validateMotionVersion(tweenVersion)).not.toThrow();
    expect(() => validateMotionVersion(springVersion)).not.toThrow();
  });

  it('rejects structural properties in keyframes', () => {
    const bad: MotionVersion = {
      ...tweenVersion,
      keyframes: [{ display: 'none' }],
    };
    expect(() => validateMotionVersion(bad)).toThrow('structural property');
  });

  it('rejects unknown top-level properties', () => {
    const bad = { ...tweenVersion, innerHTML: '<script>' } as unknown as MotionVersion;
    expect(() => validateMotionVersion(bad)).toThrow('disallowed property');
  });
});
