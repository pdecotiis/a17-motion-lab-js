/**
 * Copy to tests/unit/<component-name>.test.ts and fill in.
 * Every new component and version requires these test cases.
 */
import { describe, it, expect } from 'vitest';
import { resolveTiming, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
// import { v1, v2 } from '../../components/<name>/motion.js'; // versions live in components/<name>/versions/

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('<ComponentName> motion versions', () => {
  describe('v1', () => {
    it.todo('validates (no structural keyframe properties)', () => {
      // expect(() => validateMotionVersion(v1)).not.toThrow();
    });

    it.todo('produces a numeric duration', () => {
      // const t = resolveTiming(v1, raw);
      // expect(typeof t.duration).toBe('number');
      // expect(t.duration).toBeGreaterThan(0);
    });

    it.todo('produces a valid easing string', () => {
      // const t = resolveTiming(v1, raw);
      // expect(typeof t.easing).toBe('string');
      // expect(t.easing.length).toBeGreaterThan(0);
    });
  });

  // Repeat for v2, v3, etc.
});

// Silence unused import warnings in template
void raw;
void resolveTiming;
void validateMotionVersion;
