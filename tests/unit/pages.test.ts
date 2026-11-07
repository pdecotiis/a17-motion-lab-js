import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { checkPageVersions, validatePageVersion, type PageVersion } from '../../lab/lib/page-versions.js';
import type { ComponentModule, PageConfig } from '../../lab/lib/types.js';

// Every page in the repo, its components and its saved page versions agree.

const pageModules = import.meta.glob<PageConfig>('../../pages/*/page.json', { eager: true, import: 'default' });
const versionModules = import.meta.glob<unknown>('../../pages/*/versions/*.json', { eager: true, import: 'default' });
const componentModules = import.meta.glob<ComponentModule>('../../components/*/motion.ts', { eager: true, import: 'default' });

const modules: Record<string, ComponentModule> = {};
for (const [path, module] of Object.entries(componentModules)) {
  const name = /\/components\/([^/]+)\/motion\.ts$/.exec(path)?.[1];
  if (name) modules[name] = module;
}

const pages = Object.entries(pageModules).map(([path, page]) => ({ folder: /\/pages\/([^/]+)\/page\.json$/.exec(path)![1]!, page }));

describe('pages', () => {
  // A fresh project has no pages yet, so this checks the glob finds every folder, not that there is one.
  it('finds every page in pages/', () => {
    const dir = join(process.cwd(), 'pages');
    const onDisk = existsSync(dir) ? readdirSync(dir).filter(f => existsSync(join(dir, f, 'page.json'))).length : 0;
    expect(pages.length).toBe(onDisk);
  });

  describe.each(pages)('$folder', ({ folder, page }) => {
    it('has an id that matches its folder and a title', () => {
      expect(page.id).toBe(folder);
      expect(page.title).toBeTruthy();
    });

    it('lists components that exist, with unique ids', () => {
      const ids = page.components.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const c of page.components) expect(modules[c.component], `component "${c.component}" does not exist`).toBeDefined();
    });

    it('has a width only when it is a positive number', () => {
      if (page.width !== undefined) expect(page.width).toBeGreaterThan(0);
    });

    it('has page versions that are valid and point at real component versions', () => {
      const saved: PageVersion[] = [];
      for (const [path, data] of Object.entries(versionModules)) {
        if (!path.includes(`/pages/${folder}/versions/`)) continue;
        const file = /\/(v\d+)\.json$/.exec(path)?.[1];
        const version = validatePageVersion(data);
        expect(version.id, `${path} must be named after its id`).toBe(file);
        saved.push(version);
      }
      expect(checkPageVersions(saved, page, modules)).toEqual([]);
    });
  });
});
