import { describe, it, expect } from 'vitest';
import { resolveTiming, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
import { v1, versions } from '../../components/page-header/motion.js';
import { validateVersionMeta } from '../../lab/lib/version-meta.js';
import { validateImportedComponent } from '../../scripts/figma-import/lib.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('Page Header motion versions', () => {
  describe('v1 (Default Entrance — tween)', () => {
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

    it('resolves motion.timings.slow to a concrete duration', () => {
      expect(resolveTiming(v1, raw).duration).toBe(Number.parseFloat(String((raw as Record<string, unknown>)['motion.timings.slow'])));
    });
  });

  it('has valid version metadata', () => {
    expect(() => validateVersionMeta(versions)).not.toThrow();
  });

  it('is a valid imported component folder', () => {
    expect(validateImportedComponent(process.cwd(), 'page-header')).toEqual([]);
  });
});
