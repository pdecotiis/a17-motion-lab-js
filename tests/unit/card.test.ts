import { describe, it, expect } from 'vitest';
import { resolveTiming, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
import { v1, v2 } from '../../components/card/motion.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('Card motion versions', () => {
  describe('v1 (Fade Up - tween)', () => {
    it('validates with no structural keyframe properties', () => {
      expect(() => validateMotionVersion(v1)).not.toThrow();
    });

    it('produces a numeric duration', () => {
      const t = resolveTiming(v1, raw);
      expect(typeof t.duration).toBe('number');
      expect(t.duration).toBeGreaterThan(0);
    });

    it('produces a cubic-bezier easing string', () => {
      const t = resolveTiming(v1, raw);
      expect(t.easing).toContain('cubic-bezier');
    });

    it('resolves duration token motion.timings.base to 300ms', () => {
      const t = resolveTiming(v1, raw);
      expect(t.duration).toBe(300);
    });
  });

  describe('v2 (Scale In - spring)', () => {
    it('validates with no structural keyframe properties', () => {
      expect(() => validateMotionVersion(v2)).not.toThrow();
    });

    it('produces a numeric duration', () => {
      const t = resolveTiming(v2, raw);
      expect(typeof t.duration).toBe('number');
      expect(t.duration).toBeGreaterThan(0);
    });

    it('produces a cubic-bezier easing string', () => {
      const t = resolveTiming(v2, raw);
      expect(t.easing).toContain('cubic-bezier');
    });
  });
});
