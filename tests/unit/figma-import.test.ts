import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  importComponent, validateImportedComponent, toKebab, parseFigmaUrl,
  cssVarName, cssVarValue, buildVisualCss, buildFontsCss, type ImportInput, type ComponentMeta,
} from '../../scripts/figma-import/lib.js';

const FIGMA_URL = 'https://www.figma.com/design/AbC123fileKey/Example-File?node-id=12-345';

describe('naming and variables', () => {
  it('kebab-cases Figma layer names', () => {
    expect(toKebab('hero banner')).toBe('hero-banner');
    expect(toKebab('Hero Banner/Large')).toBe('hero-banner-large');
    expect(toKebab('type=default')).toBe('type-default');
  });

  it('parses file key and node id from a Figma link', () => {
    expect(parseFigmaUrl(FIGMA_URL)).toEqual({ fileKey: 'AbC123fileKey', nodeId: '12:345' });
  });

  it('uses the branch key when the link points at a branch', () => {
    const url = 'https://www.figma.com/design/mainKey/branch/branchKey/Example?node-id=1-2';
    expect(parseFigmaUrl(url).fileKey).toBe('branchKey');
  });

  it('rejects a link without a node id', () => {
    expect(() => parseFigmaUrl('https://www.figma.com/design/AbC123fileKey/Example-File')).toThrow(/node-id/);
  });

  it('maps Figma variables to CSS custom properties', () => {
    expect(cssVarName('grid/xl/col-8')).toBe('--grid-xl-col-8');
    expect(cssVarValue('space/3', '12')).toBe('12px');
    expect(cssVarValue('layout/columns', '12')).toBe('12');
    expect(cssVarValue('text/default', '#112233')).toBe('#112233');
    expect(cssVarValue('heading/weight', 'Regular')).toBe('400');
    expect(cssVarValue('label/family', 'Acme Mono')).toMatch(/^"Acme Mono", .*monospace$/);
    expect(cssVarValue('body/family', 'Acme Sans')).toMatch(/^"Acme Sans", .*sans-serif$/);
  });

  it('writes sorted, generated-header CSS from a variable map', () => {
    const css = buildVisualCss({ 'space/3': '12', 'color/a': '#fff' });
    expect(css).toContain('Do not edit by hand');
    expect(css.indexOf('--color-a')).toBeLessThan(css.indexOf('--space-3'));
    expect(css).toContain('--space-3: 12px;');
  });

  it('matches /fonts files to Figma typefaces and reports missing ones', () => {
    const root = mkdtempSync(join(tmpdir(), 'ml-fonts-'));
    try {
      const vars = { 'a/family': 'Acme Sans', 'a/weight': 'Regular', 'b/family': 'Acme Mono', 'b/weight': 'Regular' };
      expect(buildFontsCss(root, vars).missing).toEqual(['Acme Sans Regular', 'Acme Mono Regular']);
      mkdirSync(join(root, 'fonts'));
      writeFileSync(join(root, 'fonts/AcmeMono-Regular.woff2'), '');
      const { css, missing } = buildFontsCss(root, vars);
      expect(missing).toEqual(['Acme Sans Regular']);
      expect(css).toContain('url("../fonts/AcmeMono-Regular.woff2")');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('import', () => {
  let root: string;
  let input: ImportInput;
  const dir = () => join(root, 'components/demo-block');

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ml-import-'));
    const asset = join(root, 'src-image.png');
    writeFileSync(asset, 'png-v1');
    input = {
      name: 'demo-block',
      layerName: 'demo block',
      figmaUrl: FIGMA_URL,
      markup: '<section class="demo-block" data-motion-target data-motion="demo-block"><img src="assets/image.png" alt="" /></section>',
      styles: '.demo-block { color: var(--text-default); }',
      assets: { 'image.png': asset },
      variables: { 'text/default': '#112233' },
      frame: { width: 400, height: 300 },
      importedAt: '2026-10-01',
    };
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('writes the component folder and passes structural validation', () => {
    importComponent(root, input);
    expect(validateImportedComponent(root, 'demo-block')).toEqual([]);
    expect(readFileSync(join(dir(), 'assets/image.png'), 'utf8')).toBe('png-v1');
  });

  it('saves the Figma link, import date, frame and variables in meta.json', () => {
    importComponent(root, input);
    const meta = JSON.parse(readFileSync(join(dir(), 'meta.json'), 'utf8')) as ComponentMeta;
    expect(meta.figma).toEqual({ url: FIGMA_URL, fileKey: 'AbC123fileKey', nodeId: '12:345' });
    expect(meta.importedAt).toBe('2026-10-01');
    expect(meta.frame).toEqual({ width: 400, height: 300 });
    expect(meta.designWidth).toBe(400);
    expect(meta.variables).toEqual(['text/default']);
  });

  it('scaffolds v1 with status and lineage on first import', () => {
    const r = importComponent(root, input);
    expect(r.scaffoldedVersion).toBe(true);
    const v1 = readFileSync(join(dir(), 'versions/v1.ts'), 'utf8');
    expect(v1).toContain("status: 'in-progress'");
    expect(v1).toContain(`lineage: "imported from ${FIGMA_URL}"`);
    expect(readFileSync(join(dir(), 'motion.ts'), 'utf8')).toContain("defaultVersion = 'v1'");
  });

  it('updates markup, styles, assets and metadata on re-import but leaves version files unchanged', () => {
    importComponent(root, input);

    // Designer iterates on motion: edits v1, adds v2, edits the index.
    const v1Path = join(dir(), 'versions/v1.ts');
    writeFileSync(v1Path, readFileSync(v1Path, 'utf8').replace('Default Entrance', 'Tuned'));
    writeFileSync(join(dir(), 'versions/v2.ts'), '// v2\n');
    writeFileSync(join(dir(), 'motion.ts'), readFileSync(join(dir(), 'motion.ts'), 'utf8') + '// edited\n');
    const before = {
      v1: readFileSync(v1Path, 'utf8'),
      v2: readFileSync(join(dir(), 'versions/v2.ts'), 'utf8'),
      motion: readFileSync(join(dir(), 'motion.ts'), 'utf8'),
    };

    writeFileSync(input.assets['image.png']!, 'png-v2');
    const r = importComponent(root, {
      ...input,
      markup: input.markup.replace('demo-block"', 'demo-block demo-block--new"'),
      styles: '.demo-block { color: var(--text-secondary); }',
      variables: { 'text/secondary': '#445566' },
      importedAt: '2026-10-26',
    });

    expect(r.scaffoldedVersion).toBe(false);
    expect(readFileSync(v1Path, 'utf8')).toBe(before.v1);
    expect(readFileSync(join(dir(), 'versions/v2.ts'), 'utf8')).toBe(before.v2);
    expect(readFileSync(join(dir(), 'motion.ts'), 'utf8')).toBe(before.motion);

    expect(readFileSync(join(dir(), 'markup.html'), 'utf8')).toContain('demo-block--new');
    expect(readFileSync(join(dir(), 'styles.css'), 'utf8')).toContain('--text-secondary');
    expect(readFileSync(join(dir(), 'assets/image.png'), 'utf8')).toBe('png-v2');
    expect(JSON.parse(readFileSync(join(dir(), 'meta.json'), 'utf8')).importedAt).toBe('2026-10-26');
    // Variables merge across imports.
    const visual = readFileSync(join(root, 'tokens/visual.css'), 'utf8');
    expect(visual).toContain('--text-default: #112233;');
    expect(visual).toContain('--text-secondary: #445566;');
  });

  it('removes assets that the re-import no longer lists', () => {
    importComponent(root, input);
    importComponent(root, { ...input, assets: {}, markup: input.markup.replace('<img src="assets/image.png" alt="" />', '') });
    expect(() => readFileSync(join(dir(), 'assets/image.png'))).toThrow();
  });

  it('rejects a component name that is not kebab-case', () => {
    expect(() => importComponent(root, { ...input, name: 'DemoBlock' })).toThrow(/kebab-case/);
  });
});

describe('validateImportedComponent', () => {
  let root: string;
  let input: ImportInput;
  const dir = () => join(root, 'components/demo-block');

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ml-validate-'));
    input = {
      name: 'demo-block',
      layerName: 'demo block',
      figmaUrl: FIGMA_URL,
      markup: '<section data-motion-target data-motion="demo-block"></section>',
      styles: '.demo-block { color: var(--text-default); }',
      assets: {},
      variables: {},
      frame: { width: 400, height: 300 },
    };
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('reports missing files', () => {
    expect(validateImportedComponent(root, 'demo-block')).toContain('missing markup.html');
  });

  it('requires data-motion-target and data-motion layer names', () => {
    importComponent(root, { ...input, markup: '<section></section>' });
    const errors = validateImportedComponent(root, 'demo-block');
    expect(errors).toContain('markup.html has no data-motion-target');
    expect(errors).toContain('markup.html has no data-motion="<layer-name>" attributes');
  });

  it('flags referenced assets that do not exist', () => {
    importComponent(root, { ...input, markup: '<img data-motion-target data-motion="x" src="assets/missing.png" />' });
    expect(validateImportedComponent(root, 'demo-block')).toContain('asset not found: assets/missing.png');
  });

  it('flags temporary Figma asset URLs left in the source', () => {
    importComponent(root, { ...input, styles: '.a { background: url(https://www.figma.com/api/mcp/asset/abc); }' });
    expect(validateImportedComponent(root, 'demo-block')).toContain('temporary Figma asset URL left in source');
  });

  it('flags gaps in version file numbering', () => {
    importComponent(root, input);
    writeFileSync(join(dir(), 'versions/v3.ts'), '// v3\n');
    expect(validateImportedComponent(root, 'demo-block').join('\n')).toMatch(/without gaps \(found v3\.ts\)/);
  });
});
