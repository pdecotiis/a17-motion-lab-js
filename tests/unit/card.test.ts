import { describe, it, expect } from 'vitest';
import { resolveTiming, resolveKeyframes, buildSpringWaapiKeyframes, springParts, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
import { v1, v2, v3, versions } from '../../components/card/motion.js';
import { validateVersionMeta, filterVersions } from '../../lab/lib/version-meta.js';
import { getTokenRefs, pairingWarnings } from '../../lab/lib/token-refs.js';

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

    it('plays duration.220 with productive-entrance (220ms)', () => {
      const t = resolveTiming(v1, raw);
      expect(t.duration).toBe(220);
      expect(t.easing).toBe('cubic-bezier(0, 0, 0.38, 0.9)');
    });

    it('names its travel distance as a token, so the keyframes resolve to 16px', () => {
      expect(v1.keyframes![0]!.transform).toBe('translateY({distance.16})');
      expect(resolveKeyframes(v1.keyframes, raw)[0]!.transform).toBe('translateY(16px)');
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

    it('plays productive-entrance as a spring: bounce-0, over duration.300 / 0.82', () => {
      const parts = springParts(v2.model as never, raw);
      expect(parts).toMatchObject({ bounce: 0, pairedMs: 300, bounceToken: 'bounce.0' });
      expect(parts.durationMs).toBeCloseTo(300 / 0.82, 6);
      const { duration } = buildSpringWaapiKeyframes(v2, raw);
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(3000); // within maxMs cap
    });

    it('bounce-0 means the scale never overshoots 1', () => {
      const { keyframes } = buildSpringWaapiKeyframes(v2, raw);
      const scales = keyframes
        .map(kf => kf.transform)
        .filter((t): t is string => typeof t === 'string')
        .map(t => parseFloat(t.replace('scale(', '')));
      expect(scales.some(sc => sc > 1.0)).toBe(false);
    });
  });
});

describe('Card tokens', () => {
  it('every version uses tokens that exist, with no hard-coded values and no pairing warnings', () => {
    for (const v of versions) {
      const { tokens, hardcoded } = getTokenRefs(v, raw);
      expect(hardcoded, `${v.id} hard-coded values`).toEqual([]);
      expect(tokens.every(t => t in raw), `${v.id} unknown tokens`).toBe(true);
      expect(pairingWarnings(v, raw), `${v.id} pairing`).toEqual([]);
    }
  });

  it('staggers with delay tokens', () => {
    expect(versions.map(v => v.stagger)).toEqual(['delay.70', 'delay.120', 'delay.70']);
  });
});

describe('Card status and lineage', () => {
  it('every version has valid status and lineage', () => {
    expect(() => validateVersionMeta(versions)).not.toThrow();
  });

  it('v3 validates and is archived, forked from v1', () => {
    expect(() => validateMotionVersion(v3)).not.toThrow();
    expect(v3.status).toBe('archived');
    expect(v3.forkedFrom).toBe('v1');
  });

  it('archived v3 is hidden from the default version list', () => {
    expect(filterVersions(versions).map(v => v.id)).toEqual(['v1', 'v2']);
  });
});
