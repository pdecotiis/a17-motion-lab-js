import { describe, it, expect } from 'vitest';
import { validateMotionVersion } from '../../lab/lib/motion-models.js';
import { validateVersionMeta } from '../../lab/lib/version-meta.js';
import { getTokenRefs, pairingWarnings } from '../../lab/lib/token-refs.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { ComponentModule, DtcgGroup } from '../../lab/lib/types.js';

// Every version of every component in the repo, whatever the project: it validates, has lineage, names
// only tokens that exist, and follows the pairing rules. A new version is covered here without its own
// test; a component's own test file can still check what is particular to it.

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

const componentModules = import.meta.glob<ComponentModule>('../../components/*/motion.ts', { eager: true, import: 'default' });
const components = Object.entries(componentModules).map(([path, module]) => ({
  name: /\/components\/([^/]+)\/motion\.ts$/.exec(path)![1]!,
  module,
}));

describe('every version of every component', () => {
  it('finds components to check', () => {
    expect(components.length).toBeGreaterThan(0);
  });

  describe.each(components)('$name', ({ module }) => {
    it('has a default version that exists, and valid metadata (status and lineage)', () => {
      expect(module.versions.map(v => v.id)).toContain(module.defaultVersion);
      expect(() => validateVersionMeta(module.versions)).not.toThrow();
    });

    it.each(module.versions.map(v => [v.id, v] as const))('%s validates (motion properties only, known fields)', (_id, version) => {
      expect(() => validateMotionVersion(version)).not.toThrow();
    });

    it.each(module.versions.map(v => [v.id, v] as const))('%s names only tokens that exist', (_id, version) => {
      expect(getTokenRefs(version, raw).hardcoded).toEqual([]);
    });

    it.each(module.versions.map(v => [v.id, v] as const))('%s follows the pairing rules', (_id, version) => {
      expect(pairingWarnings(version, raw)).toEqual([]);
    });
  });
});
