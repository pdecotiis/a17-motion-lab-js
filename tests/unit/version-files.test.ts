import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Every component keeps one file per version in versions/; motion.ts only re-exports them.

const componentsDir = join(process.cwd(), 'components');
const components = readdirSync(componentsDir).filter(f => statSync(join(componentsDir, f)).isDirectory());

// A version defined inline: `export const v2 = …` / `const v2: MotionVersion = …` or an `id: 'v2'` literal.
const INLINE_VERSION = /\b(?:const|let|var)\s+v\d+\b|\bid\s*:\s*['"]v\d+['"]/;

describe('one file per version', () => {
  it('finds components to check', () => {
    expect(components.length).toBeGreaterThan(0);
  });

  describe.each(components)('%s', name => {
    const dir = join(componentsDir, name);

    it('has versions/ with v1.ts', () => {
      expect(existsSync(join(dir, 'versions', 'v1.ts'))).toBe(true);
    });

    it('numbers version files v1.ts, v2.ts, … without gaps', () => {
      const files = readdirSync(join(dir, 'versions')).filter(f => f.endsWith('.ts'));
      const nums = files.map(f => /^v(\d+)\.ts$/.exec(f)?.[1]);
      expect(nums.every(Boolean), `unexpected file in versions/: ${files.join(', ')}`).toBe(true);
      expect(nums.map(Number).sort((a, b) => a - b)).toEqual(files.map((_, i) => i + 1));
    });

    it('does not define versions inside motion.ts', () => {
      const source = readFileSync(join(dir, 'motion.ts'), 'utf8');
      expect(source).not.toMatch(INLINE_VERSION);
    });
  });
});
