import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PRESET_NAMES } from '../../lab/lib/entrance-presets.js';

// The entrance presets belong to the project, not to a version: `npm run spec` writes them once, to
// <out>/presets/, and a version that uses them imports them from there. Run on a small project built in a
// temporary folder (--root), with one version that uses a preset and one that does not, so it holds in any repo.

const repo = resolve(import.meta.dirname, '../..');
const project = mkdtempSync(join(tmpdir(), 'motion-lab-presets-project-'));
const preset = PRESET_NAMES[0]!;

beforeAll(() => {
  mkdirSync(join(project, 'tokens'), { recursive: true });
  copyFileSync(join(repo, 'tokens/motion.json'), join(project, 'tokens/motion.json'));
  const dir = join(project, 'components/demo');
  mkdirSync(join(dir, 'versions'), { recursive: true });
  writeFileSync(join(dir, 'versions/v1.ts'), `export const v1 = {
  id: 'v1', label: 'Plain', lineage: 'test',
  model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
};
`);
  writeFileSync(join(dir, 'versions/v2.ts'), `export const v2 = {
  id: 'v2', label: 'Preset', forkedFrom: 'v1',
  entrance: { preset: ${JSON.stringify(preset)} },
  layers: { title: { preset: ${JSON.stringify(preset)}, delay: 'delay.70' } },
};
`);
  writeFileSync(join(dir, 'motion.ts'), `import { v1 } from './versions/v1';
import { v2 } from './versions/v2';
export const versions = [v1, v2];
export const defaultVersion = 'v1';
export default { versions, defaultVersion };
`);
});
afterAll(() => rmSync(project, { recursive: true, force: true }));

const run = (out: string, ...args: string[]) =>
  spawnSync('npx', ['vite-node', 'scripts/export-spec.ts', '--', ...args, '--root', project, '--out', out], { cwd: repo, encoding: 'utf8' });
const outDir = () => mkdtempSync(join(tmpdir(), 'motion-lab-presets-out-'));
const files = (dir: string) => (existsSync(dir) ? readdirSync(dir).sort() : []);

describe('npm run spec -- --presets', () => {
  it('writes just the project\'s shared presets, every format, and no component', () => {
    const out = outDir();
    try {
      const r = run(out, '--presets');
      expect(r.status, r.stderr).toBe(0);
      expect(readdirSync(out)).toEqual(['presets']);
      expect(files(join(out, 'presets'))).toEqual(['presets.css', 'presets.gsap.js', 'presets.motion.js']);
      expect(readFileSync(join(out, 'presets/presets.css'), 'utf8')).toContain(`.motion-preset-${preset}`);
    } finally { rmSync(out, { recursive: true, force: true }); }
  });

  it('writes only the formats asked for (the CSS is always there)', () => {
    const out = outDir();
    try {
      expect(run(out, '--presets', '--format', 'gsap').status).toBe(0);
      expect(files(join(out, 'presets'))).toEqual(['presets.css', 'presets.gsap.js']);
    } finally { rmSync(out, { recursive: true, force: true }); }
  });
});

describe('a version that uses presets', () => {
  it('imports the shared presets from <out>/presets/ and gets no copy of its own', () => {
    const out = outDir();
    try {
      const r = run(out, 'demo', 'v2', '--format', 'all');
      expect(r.status, r.stderr).toBe(0);
      expect(files(join(out, 'demo/v2'))).toEqual(['motion.css', 'motion.gsap.js', 'motion.motion.js', 'spec.md', 'tokens.css']);
      expect(files(join(out, 'presets'))).toEqual(['presets.css', 'presets.gsap.js', 'presets.motion.js']);
      expect(readFileSync(join(out, 'demo/v2/motion.gsap.js'), 'utf8')).toContain('from "../../presets/presets.gsap.js"');
      expect(readFileSync(join(out, 'demo/v2/motion.motion.js'), 'utf8')).toContain('from "../../presets/presets.motion.js"');
      expect(readFileSync(join(out, 'demo/v2/spec.md'), 'utf8')).toContain('shared by the whole project, in `presets/`');
    } finally { rmSync(out, { recursive: true, force: true }); }
  });

  it('shares one presets folder however many versions are exported', () => {
    const out = outDir();
    try {
      expect(run(out, 'demo', 'v2').status).toBe(0);
      expect(run(out, 'demo', 'v2').status).toBe(0);
      expect(readdirSync(out).sort()).toEqual(['demo', 'presets']);
      expect(files(join(out, 'presets'))).toEqual(['presets.css']);
    } finally { rmSync(out, { recursive: true, force: true }); }
  });
});

describe('a version that uses no presets', () => {
  it('writes no presets folder', () => {
    const out = outDir();
    try {
      const r = run(out, 'demo', 'v1', '--format', 'all');
      expect(r.status, r.stderr).toBe(0);
      expect(readdirSync(out)).toEqual(['demo']);
      expect(files(join(out, 'demo/v1'))).toEqual(['motion.css', 'motion.gsap.js', 'motion.motion.js', 'spec.md', 'tokens.css']);
    } finally { rmSync(out, { recursive: true, force: true }); }
  });
});
