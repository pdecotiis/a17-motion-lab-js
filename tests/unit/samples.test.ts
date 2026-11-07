import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { SAMPLE_FILES, SAMPLE_E2E_FILES, SAMPLE_UNIT_FILES, LAB_E2E_FILES, WEBKIT_SKIP_FILES } from '../samples.js';

// The template's sample content (card, side-panel, home) is deleted in a project repo. Every test that
// needs it must be listed in tests/samples.ts or guard itself with SAMPLES_PRESENT, or a project's
// `npm run check` breaks.

const root = process.cwd();

function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...testFiles(rel));
    else if (/\.(test|spec)\.ts$/.test(entry.name)) out.push(rel);
  }
  return out;
}

// A test "uses a sample" when it opens one by URL (component=card, page=home) or imports one. A test that
// writes a `components/card/` into a temporary folder for itself does not. (A unit test that runs the CLI on
// a sample is not caught here: list it, or guard it, by hand.)
// The name must end there: a project's own `card-feature` or `home-news` is not the sample `card` or `home`.
export const USES_SAMPLE = /component=(card|side-panel)(?![\w-])|page=home(?![\w-])|from '[./]*components\/(card|side-panel)\//;

const files = [...testFiles('tests/unit'), ...testFiles('tests/e2e')].filter(f => !f.endsWith('samples.test.ts'));
const listed = new Set([...SAMPLE_UNIT_FILES, ...SAMPLE_E2E_FILES]);

describe('sample content in tests', () => {
  it.each(files)('%s names a sample only if it is listed or guarded', file => {
    const source = readFileSync(join(root, file), 'utf8');
    if (!USES_SAMPLE.test(source)) return;
    const guarded = listed.has(file) || source.includes('SAMPLES_PRESENT');
    expect(guarded, `${file} uses the sample content: list it in tests/samples.ts, or start the tests that need it with test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED)`).toBe(true);
  });

  it('lists only files that exist and that use a sample', () => {
    for (const file of listed) {
      expect(existsSync(join(root, file)), `${file} is listed in tests/samples.ts but does not exist`).toBe(true);
      expect(USES_SAMPLE.test(readFileSync(join(root, file), 'utf8')), `${file} is listed in tests/samples.ts but no longer uses a sample`).toBe(true);
    }
  });

  it('names sample files that are paths inside the repo', () => {
    for (const f of SAMPLE_FILES) expect(relative(root, join(root, f)).startsWith('..')).toBe(false);
  });
});

describe('what counts as using a sample', () => {
  it('is the sample itself, by URL or import', () => {
    expect(USES_SAMPLE.test('/?view=component&component=card')).toBe(true);
    expect(USES_SAMPLE.test('/?view=component&component=card&version=v1')).toBe(true);
    expect(USES_SAMPLE.test('/?view=component&component=side-panel')).toBe(true);
    expect(USES_SAMPLE.test('/?view=page&page=home')).toBe(true);
    expect(USES_SAMPLE.test('/?view=page&page=home&pv=v2')).toBe(true);
    expect(USES_SAMPLE.test("import { v1 } from '../../components/card/versions/v1.js'")).toBe(true);
  });
  it('is not a project\'s own component or page whose name starts with the sample\'s', () => {
    expect(USES_SAMPLE.test('/?view=component&component=card-feature')).toBe(false);
    expect(USES_SAMPLE.test('/?view=component&component=card-feature&version=v1')).toBe(false);
    expect(USES_SAMPLE.test('/?view=component&component=side-panel-wide')).toBe(false);
    expect(USES_SAMPLE.test('/?view=page&page=homepage')).toBe(false);
    expect(USES_SAMPLE.test('/?view=page&page=home-news')).toBe(false);
  });
});

describe('the lab and WebKit spec lists', () => {
  it('name specs that exist', () => {
    for (const f of [...LAB_E2E_FILES, ...WEBKIT_SKIP_FILES]) expect(existsSync(join(root, f)), `${f} is listed in tests/samples.ts but does not exist`).toBe(true);
  });
  it('skip in WebKit only specs that are the lab\'s own or plain layout: never an every-version, trigger or component spec', () => {
    for (const f of ['tests/e2e/all-versions.spec.ts', 'tests/e2e/interaction-triggers.spec.ts', 'tests/e2e/reduced-motion.spec.ts']) expect(WEBKIT_SKIP_FILES).not.toContain(f);
  });
});
