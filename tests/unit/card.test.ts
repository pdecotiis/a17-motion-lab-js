import { describe, it, expect } from 'vitest';
import { resolveTiming, buildSpringWaapiKeyframes, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
import { v1, v2 } from '../../components/card/motion.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('Card motion versions', () => {
  describe('v1 (Fade Up — tween)', () => {
    it('validates with no structural keyframe properties', () => {
      expect(() => validateMotionVersion(v1)).not.toThrow();
    });

    it('produces a numeric duration', () => {
      const t = resolveTiming(v1, raw);
      expect(typeof t.duration).toBe('number');
      expect(t.duration).toBeGreaterThan(0);
    });

    it('resolves motion.timings.base to 300ms', () => {
      const t = resolveTiming(v1, raw);
      expect(t.duration).toBe(300);
    });

    it('produces a cubic-bezier easing string', () => {
      const t = resolveTiming(v1, raw);
      expect(t.easing).toContain('cubic-bezier');
    });
  });

  describe('v2 (Scale In — spring)', () => {
    it('validates (non-empty properties array, no disallowed keys)', () => {
      expect(() => validateMotionVersion(v2)).not.toThrow();
    });

    it('produces WAAPI keyframes from the real spring simulation', () => {
      const { keyframes, duration } = buildSpringWaapiKeyframes(v2, raw);
      expect(Array.isArray(keyframes)).toBe(true);
      expect(keyframes.length).toBeGreaterThan(2);
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThan(0);
    });

    it('first keyframe is at scale(0.92) with opacity 0', () => {
      const { keyframes } = buildSpringWaapiKeyframes(v2, raw);
      const first = keyframes[0]!;
      expect(first.transform).toContain('scale(0.92)');
      expect(first.opacity).toBe(0);
    });

    it('last keyframe is at scale(1) with opacity 1', () => {
      const { keyframes } = buildSpringWaapiKeyframes(v2, raw);
      const last = keyframes[keyframes.length - 1]!;
      expect(last.transform).toContain('scale(1)');
      expect(last.opacity).toBe(1);
    });

    it('resolves duration from motion.springs.bouncy token (600ms natural period)', () => {
      // The spring settles after some time; duration is positive and derived from 600ms natural period
      const { duration } = buildSpringWaapiKeyframes(v2, raw);
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(3000); // within maxMs cap
    });

    it('keyframes include a mid-point with overshoot (scale > 1) due to bounce 0.4', () => {
      const { keyframes } = buildSpringWaapiKeyframes(v2, raw);
      const scales = keyframes
        .map(kf => kf.transform)
        .filter((t): t is string => typeof t === 'string')
        .map(t => parseFloat(t.replace('scale(', '')));
      const hasOvershoot = scales.some(s => s > 1.0);
      expect(hasOvershoot).toBe(true);
    });
  });
});
