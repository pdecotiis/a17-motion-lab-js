import { describe, it, expect, afterAll } from 'vitest';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runScale } from '../../scripts/scale-run.js';
import { handleScaleRequest } from '../../scripts/scale-plugin.js';
import { readScaleConfig, SCALE_KINDS } from '../../lab/lib/scale-apply.js';

// What the Apply button runs, on a throwaway copy of the tokens and a version file that uses them.
const repo = resolve(__dirname, '../..');
const base = mkdtempSync(join(tmpdir(), 'motion-lab-apply-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));

const version = [
  "export const v1 = {",
  "  model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance' },",
  "  keyframes: [{ transform: 'translateY({distance.16})', opacity: '{opacity.56}' }],",
  "};",
  "",
].join('\n');

const setup = (): string => {
  const root = mkdtempSync(join(base, 'root-'));
  mkdirSync(join(root, 'tokens'));
  cpSync(join(__dirname, 'fixtures/old-motion.json'), join(root, 'tokens/motion.json'));
  mkdirSync(join(root, 'components/card/versions'), { recursive: true });
  writeFileSync(join(root, 'components/card/versions/v1.ts'), version);
  return root;
};
const tokensOf = (root: string) => JSON.parse(readFileSync(join(root, 'tokens/motion.json'), 'utf8')) as Record<string, unknown>;

describe('runScale', () => {
  it('writes the tokens and the version files, and reports the files it changed', () => {
    const root = setup();
    const run = runScale({ root, kinds: [...SCALE_KINDS], scale: 'major-third' });
    expect(run.dryRun).toBe(false);
    expect(run.versionFiles).toEqual(['components/card/versions/v1.ts']);
    expect(readScaleConfig(tokensOf(root)).distance).toEqual({ scale: 'major-third' });
    const text = readFileSync(join(root, 'components/card/versions/v1.ts'), 'utf8');
    expect(text).toContain('{distance.8}');
    expect(text).not.toContain('{distance.16}');
    expect(run.renames['distance.16']).toBe('distance.8');
  });

  it('a dry run reports the same and writes nothing', () => {
    const root = setup();
    const before = readFileSync(join(root, 'tokens/motion.json'), 'utf8');
    const run = runScale({ root, kinds: [...SCALE_KINDS], scale: 'perfect-fourth', dryRun: true });
    expect(run.dryRun).toBe(true);
    expect(run.versionFiles).toEqual(['components/card/versions/v1.ts']);
    expect(readFileSync(join(root, 'tokens/motion.json'), 'utf8')).toBe(before);
    expect(readFileSync(join(root, 'components/card/versions/v1.ts'), 'utf8')).toBe(version);
  });

  it('a scale that does not fit throws before anything is written', () => {
    const root = setup();
    const before = readFileSync(join(root, 'tokens/motion.json'), 'utf8');
    expect(() => runScale({ root, kinds: ['distance'], scale: 'minor-third', options: { distance: { base: 1 } } })).toThrow('use a larger base or ratio');
    expect(readFileSync(join(root, 'tokens/motion.json'), 'utf8')).toBe(before);
    expect(readFileSync(join(root, 'components/card/versions/v1.ts'), 'utf8')).toBe(version);
  });
});

describe('handleScaleRequest: the dev server endpoint', () => {
  it('GET says the endpoint is there, which is how the button knows it can apply', () => {
    expect(handleScaleRequest(setup(), { method: 'GET' })).toEqual({ status: 200, body: { available: true } });
  });

  it('POST applies the scale to every kind and says what changed', () => {
    const root = setup();
    const res = handleScaleRequest(root, { method: 'POST', host: 'localhost:5173', origin: 'http://localhost:5173', body: JSON.stringify({ scale: 'major-third' }) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ scale: 'major-third', dryRun: false, versionFiles: ['components/card/versions/v1.ts'] });
    expect((res.body as { renamed: number }).renamed).toBe(29);
    expect(Object.keys(readScaleConfig(tokensOf(root)))).toEqual([...SCALE_KINDS]);
  });

  it('dryRun applies nothing', () => {
    const root = setup();
    const before = readFileSync(join(root, 'tokens/motion.json'), 'utf8');
    const res = handleScaleRequest(root, { method: 'POST', body: JSON.stringify({ scale: 'golden-ratio', dryRun: true }) });
    expect(res.status).toBe(200);
    expect((res.body as { dryRun: boolean }).dryRun).toBe(true);
    expect(readFileSync(join(root, 'tokens/motion.json'), 'utf8')).toBe(before);
  });

  it('refuses a request from another site, before touching any file', () => {
    const root = setup();
    const before = readFileSync(join(root, 'tokens/motion.json'), 'utf8');
    const res = handleScaleRequest(root, { method: 'POST', host: 'localhost:5173', origin: 'https://evil.example', body: JSON.stringify({ scale: 'major-third' }) });
    expect(res.status).toBe(403);
    expect(handleScaleRequest(root, { method: 'GET', host: 'localhost:5173', origin: 'not a url' }).status).toBe(403);
    expect(readFileSync(join(root, 'tokens/motion.json'), 'utf8')).toBe(before);
  });

  it('says what is wrong with a bad request, and changes nothing', () => {
    const root = setup();
    const before = readFileSync(join(root, 'tokens/motion.json'), 'utf8');
    expect(handleScaleRequest(root, { method: 'POST', body: 'not json' }).status).toBe(400);
    expect(handleScaleRequest(root, { method: 'POST', body: '{}' })).toEqual({ status: 400, body: { error: 'Say which scale to apply.' } });
    const unknown = handleScaleRequest(root, { method: 'POST', body: JSON.stringify({ scale: 'lydian' }) });
    expect(unknown.status).toBe(400);
    expect((unknown.body as { error: string }).error).toContain('Unknown scale');
    expect(handleScaleRequest(root, { method: 'DELETE' }).status).toBe(405);
    expect(readFileSync(join(root, 'tokens/motion.json'), 'utf8')).toBe(before);
  });
});
