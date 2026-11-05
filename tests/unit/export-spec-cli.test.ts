import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { SAMPLES_PRESENT } from '../samples.js';

// `npm run spec` as a developer runs it: --format picks the code written beside motion.css.
const root = resolve(import.meta.dirname, '../..');
const out = mkdtempSync(join(tmpdir(), 'motion-lab-spec-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

const run = (...args: string[]) =>
  spawnSync('npx', ['vite-node', 'scripts/export-spec.ts', '--', ...args, '--out', out], { cwd: root, encoding: 'utf8' });

describe.skipIf(!SAMPLES_PRESENT)('npm run spec --format', () => {
  it('writes only motion.css, tokens.css and spec.md by default', () => {
    execFileSync('npx', ['vite-node', 'scripts/export-spec.ts', '--', 'card', 'v1', '--out', out], { cwd: root });
    const dir = join(out, 'card', 'v1');
    expect(existsSync(join(dir, 'motion.css'))).toBe(true);
    expect(existsSync(join(dir, 'spec.md'))).toBe(true);
    expect(existsSync(join(dir, 'motion.gsap.js'))).toBe(false);
    expect(existsSync(join(dir, 'motion.motion.js'))).toBe(false);
    expect(readFileSync(join(dir, 'spec.md'), 'utf8')).toContain('--format gsap');
  });

  it('--format gsap adds motion.gsap.js, --format motion adds motion.motion.js, --format all adds both', () => {
    expect(run('card', 'v2', '--format', 'gsap').status).toBe(0);
    expect(readFileSync(join(out, 'card', 'v2', 'motion.gsap.js'), 'utf8')).toContain('import { gsap } from "gsap"');
    expect(existsSync(join(out, 'card', 'v2', 'motion.motion.js'))).toBe(false);

    expect(run('card', 'v1', '--format', 'motion').status).toBe(0);
    expect(readFileSync(join(out, 'card', 'v1', 'motion.motion.js'), 'utf8')).toContain('import { animate } from "motion"');

    expect(run('side-panel', 'v1', '--format', 'all').status).toBe(0);
    for (const f of ['motion.css', 'motion.gsap.js', 'motion.motion.js']) expect(existsSync(join(out, 'side-panel', 'v1', f)), f).toBe(true);
  });

  it('--bounce picks the global bounce token for the Motion code', () => {
    expect(run('card', 'v1', '--format', 'motion', '--bounce', '50').status).toBe(0);
    const code = readFileSync(join(out, 'card', 'v1', 'motion.motion.js'), 'utf8');
    expect(code).toContain('global bounce setting (bounce.50)');
    expect(code).toContain('bounce: 0.5');
  });

  it('rejects an unknown format or bounce, saying what is allowed', () => {
    const format = run('card', 'v1', '--format', 'lottie');
    expect(format.status).toBe(1);
    expect(format.stderr).toContain('--format must be one of css, gsap, motion or all');
    const bounce = run('card', 'v1', '--format', 'motion', '--bounce', '99');
    expect(bounce.status).toBe(1);
    expect(bounce.stderr).toContain('is not a bounce token (try 0, 25, 50)');
  });
});

describe.skipIf(!SAMPLES_PRESENT)('npm run spec with no version', () => {
  it('refuses a component that is not approved, and says how to export one anyway', () => {
    const r = run('card');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('is not approved');
    expect(r.stderr).toContain('Pass a version id');
  });
});
