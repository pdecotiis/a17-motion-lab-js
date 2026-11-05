import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importPage, slotIds, validateImportedPage, type PageImportInput } from '../../scripts/figma-import/page.js';

// A generic page in a temp folder; nothing from a real project.
const FIGMA_URL = 'https://www.figma.com/design/AbC123fileKey/Example-File?node-id=12-345';

let root: string;

function write(rel: string, content: string): void {
  const path = join(root, rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

// A minimal imported component: motion.ts with a default version, and version files.
function component(name: string, versions: string[], defaultVersion = 'v1'): void {
  write(`components/${name}/motion.ts`, `export const defaultVersion = '${defaultVersion}';\n`);
  for (const v of versions) write(`components/${name}/versions/${v}.ts`, '');
}

const input = (over: Partial<PageImportInput> = {}): PageImportInput => ({
  id: 'about',
  title: 'About',
  figmaUrl: FIGMA_URL,
  frame: { width: 1440, height: 5136 },
  width: 1136,
  sections: [
    { component: 'hero', figmaName: 'page header' },
    { component: 'section', figmaName: 'section header' },
    { component: 'section', figmaName: 'section header' },
    { component: 'footer' },
  ],
  notImported: [{ name: 'menu', reason: 'off-canvas menu' }],
  importedAt: '2026-11-05',
  ...over,
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ml-page-import-'));
  component('hero', ['v1', 'v2'], 'v2');
  component('section', ['v1']);
  component('footer', ['v1']);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('slotIds', () => {
  it('keeps a component\'s name when it is used once and numbers it when used more than once', () => {
    expect(slotIds(input().sections)).toEqual(['hero', 'section-1', 'section-2', 'footer']);
  });
});

describe('importPage', () => {
  it('writes page.json with the sections in order, one slot each', () => {
    const result = importPage(root, input());
    expect(result.slots).toEqual(['hero', 'section-1', 'section-2', 'footer']);
    expect(JSON.parse(readFileSync(join(root, 'pages/about/page.json'), 'utf8'))).toEqual({
      id: 'about',
      title: 'About',
      width: 1136,
      components: [
        { id: 'hero', component: 'hero' },
        { id: 'section-1', component: 'section' },
        { id: 'section-2', component: 'section' },
        { id: 'footer', component: 'footer' },
      ],
    });
  });

  it('keeps a layout when a section has one', () => {
    importPage(root, input({ sections: [{ component: 'hero', layout: 'wide' }] }));
    expect(JSON.parse(readFileSync(join(root, 'pages/about/page.json'), 'utf8')).components[0]).toEqual({ id: 'hero', component: 'hero', layout: 'wide' });
  });

  it('writes meta.json with the Figma source, the frame, the sections and what was not imported', () => {
    importPage(root, input());
    const meta = JSON.parse(readFileSync(join(root, 'pages/about/meta.json'), 'utf8'));
    expect(meta.figma).toEqual({ url: FIGMA_URL, fileKey: 'AbC123fileKey', nodeId: '12:345' });
    expect(meta.frame).toEqual({ width: 1440, height: 5136 });
    expect(meta.importedAt).toBe('2026-11-05');
    expect(meta.sections[1]).toEqual({ id: 'section-1', component: 'section', figmaName: 'section header' });
    expect(meta.notImported).toEqual([{ name: 'menu', reason: 'off-canvas menu' }]);
  });

  it('saves v1 on first import: every slot on its component\'s default version', () => {
    const result = importPage(root, input());
    expect(result.scaffoldedVersion).toBe(true);
    expect(JSON.parse(readFileSync(join(root, 'pages/about/versions/v1.json'), 'utf8'))).toEqual({
      id: 'v1',
      label: 'Default',
      motionMap: { hero: 'v2', 'section-1': 'v1', 'section-2': 'v1', footer: 'v1' },
    });
    expect(validateImportedPage(root, 'about')).toEqual([]);
  });

  it('refuses a section whose component has not been imported, naming them all', () => {
    expect(() => importPage(root, input({ sections: [{ component: 'hero' }, { component: 'quotes' }, { component: 'grid' }] })))
      .toThrow('quotes, grid');
    expect(existsSync(join(root, 'pages/about'))).toBe(false);
  });

  it('refuses a bad id, no sections and no width', () => {
    expect(() => importPage(root, input({ id: 'About Us' }))).toThrow('kebab-case');
    expect(() => importPage(root, input({ sections: [] }))).toThrow('at least one section');
    expect(() => importPage(root, input({ width: 0 }))).toThrow('width');
  });

  it('on a re-import rewrites the page but never touches saved page versions', () => {
    importPage(root, input());
    const v2 = '{\n  "id": "v2",\n  "label": "Mine",\n  "motionMap": { "hero": "v1" }\n}\n';
    write('pages/about/versions/v2.json', v2);
    const result = importPage(root, input({ title: 'About us' }));
    expect(result.scaffoldedVersion).toBe(false);
    expect(result.staleVersions).toEqual([]);
    expect(JSON.parse(readFileSync(join(root, 'pages/about/page.json'), 'utf8')).title).toBe('About us');
    expect(readFileSync(join(root, 'pages/about/versions/v2.json'), 'utf8')).toBe(v2);
  });

  it('keeps saved versions even when the sections change', () => {
    importPage(root, input());
    importPage(root, input({ sections: [{ component: 'hero' }, { component: 'footer' }] }));
    expect(JSON.parse(readFileSync(join(root, 'pages/about/versions/v1.json'), 'utf8')).motionMap).toHaveProperty('section-1');
  });

  it('on a re-import says which saved versions no longer fit', () => {
    importPage(root, input());
    const result = importPage(root, input({ sections: [{ component: 'hero' }, { component: 'footer' }] }));
    expect(result.staleVersions.join('\n')).toContain('"section-1" is not on page "about"');
  });
});

describe('validateImportedPage', () => {
  it('passes an imported page', () => {
    importPage(root, input());
    expect(validateImportedPage(root, 'about')).toEqual([]);
  });

  it('reports missing files', () => {
    expect(validateImportedPage(root, 'about')).toEqual(['missing page.json', 'missing meta.json', 'missing versions/v1.json']);
  });

  it('reports a component that was removed and a saved version pointing at a version that is gone', () => {
    importPage(root, input());
    rmSync(join(root, 'components/footer'), { recursive: true });
    expect(validateImportedPage(root, 'about')).toContain('component not found: footer');
    component('footer', ['v1']);
    rmSync(join(root, 'components/hero/versions/v2.ts'));
    expect(validateImportedPage(root, 'about').join('\n')).toContain('"hero" has no version "v2"');
  });

  it('reports a bad Figma link and duplicate slot ids', () => {
    importPage(root, input());
    const meta = JSON.parse(readFileSync(join(root, 'pages/about/meta.json'), 'utf8'));
    write('pages/about/meta.json', JSON.stringify({ ...meta, figma: { url: 'https://example.com' } }));
    expect(validateImportedPage(root, 'about')).toContain('meta.json missing figma.url');
    const page = JSON.parse(readFileSync(join(root, 'pages/about/page.json'), 'utf8'));
    write('pages/about/page.json', JSON.stringify({ ...page, components: [page.components[0], page.components[0]] }));
    expect(validateImportedPage(root, 'about')).toContain('page.json has duplicate component ids');
  });
});
