/**
 * Figma page import: the deterministic, file-writing half of "page from Figma".
 *
 * The agent reads a Figma page frame (Figma MCP), imports each section as a component with the
 * component import (`npm run figma:import`), then hands this module the ordered list of sections.
 * It writes pages/<id>/page.json, pages/<id>/meta.json and, first import only, versions/v1.json
 * (every slot on its component's default version). A re-import rewrites page.json and meta.json and
 * never touches the saved page versions.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFigmaUrl, toKebab } from './lib.js';
import {
  checkPageVersions, serializePageVersion, validatePageVersion, type PageVersion,
} from '../../lab/lib/page-versions.js';
import type { ComponentModule, PageConfig } from '../../lab/lib/types.js';

export interface PageSection {
  /** The lab component this section is (a folder in components/). */
  component: string;
  /** How the lab lays it out on the page; absent = full width. */
  layout?: string;
  /** The Figma layer name, for the designer's reference. */
  figmaName?: string;
}

export interface PageImportInput {
  /** kebab-case page id, the folder name (pages/<id>/). */
  id: string;
  title: string;
  /** Link to the Figma page frame. */
  figmaUrl: string;
  /** Size of the whole Figma frame. */
  frame: { width: number; height: number };
  /** Width (px) of the content column the sections lay out in. */
  width: number;
  /** The sections in page order. A component used more than once is several slots. */
  sections: PageSection[];
  /** Parts of the frame that are not on the page (an off-canvas menu, a header, a footer), and why. */
  notImported?: { name: string; reason: string }[];
  importedAt?: string;
  /** Figma file problems for designers. */
  issues?: string[];
}

export interface PageMeta {
  id: string;
  figma: { url: string; fileKey: string; nodeId: string };
  importedAt: string;
  frame: { width: number; height: number };
  sections: { id: string; component: string; figmaName?: string }[];
  notImported: { name: string; reason: string }[];
  issues: string[];
}

export interface PageImportResult {
  pageDir: string;
  scaffoldedVersion: boolean;
  /** Slot ids in the page, in order. */
  slots: string[];
  /** Saved page versions that no longer fit the page (a slot or component went away). */
  staleVersions: string[];
}

// A component used once keeps its name as the slot id; used more than once, each is numbered.
export function slotIds(sections: PageSection[]): string[] {
  const total = new Map<string, number>();
  for (const s of sections) total.set(s.component, (total.get(s.component) ?? 0) + 1);
  const seen = new Map<string, number>();
  return sections.map(s => {
    if (total.get(s.component) === 1) return s.component;
    const n = (seen.get(s.component) ?? 0) + 1;
    seen.set(s.component, n);
    return `${s.component}-${n}`;
  });
}

function defaultVersionOf(root: string, component: string): string {
  const src = readFileSync(join(root, 'components', component, 'motion.ts'), 'utf8');
  return /defaultVersion\s*=\s*['"](v\d+)['"]/.exec(src)?.[1] ?? 'v1';
}

// Version ids a component has, from its versions/ folder.
function componentVersionIds(root: string, component: string): string[] {
  const dir = join(root, 'components', component, 'versions');
  return existsSync(dir) ? readdirSync(dir).filter(f => /^v\d+\.ts$/.test(f)).map(f => f.replace(/\.ts$/, '')) : [];
}

function savedVersions(root: string, id: string): PageVersion[] {
  const dir = join(root, 'pages', id, 'versions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => /^v\d+\.json$/.test(f))
    .map(f => validatePageVersion(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
}

// A minimal stand-in for the loaded components, enough for checkPageVersions.
function moduleStubs(root: string, components: string[]): Record<string, ComponentModule> {
  const out: Record<string, ComponentModule> = {};
  for (const c of new Set(components)) {
    if (!existsSync(join(root, 'components', c, 'motion.ts'))) continue;
    out[c] = {
      defaultVersion: defaultVersionOf(root, c),
      versions: componentVersionIds(root, c).map(id => ({ id }) as ComponentModule['versions'][number]),
    };
  }
  return out;
}

export function importPage(root: string, input: PageImportInput): PageImportResult {
  if (input.id !== toKebab(input.id)) throw new Error(`Page id must be kebab-case: "${input.id}"`);
  if (input.sections.length === 0) throw new Error('A page needs at least one section.');
  if (!(input.width > 0)) throw new Error('A page needs a positive content width.');
  const missing = [...new Set(input.sections.map(s => s.component))]
    .filter(c => !existsSync(join(root, 'components', c, 'motion.ts')));
  if (missing.length) {
    throw new Error(`Import these components first (npm run figma:import): ${missing.join(', ')}`);
  }

  const ids = slotIds(input.sections);
  const components: PageConfig['components'] = input.sections.map((s, i) => ({
    id: ids[i]!,
    component: s.component,
    ...(s.layout ? { layout: s.layout } : {}),
  }));
  const page: PageConfig = { id: input.id, title: input.title, width: input.width, components };

  const dir = join(root, 'pages', input.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'page.json'), JSON.stringify(page, null, 2) + '\n');

  const meta: PageMeta = {
    id: input.id,
    figma: { url: input.figmaUrl, ...parseFigmaUrl(input.figmaUrl) },
    importedAt: input.importedAt ?? new Date().toISOString().slice(0, 10),
    frame: input.frame,
    sections: input.sections.map((s, i) => ({
      id: ids[i]!,
      component: s.component,
      ...(s.figmaName ? { figmaName: s.figmaName } : {}),
    })),
    notImported: input.notImported ?? [],
    issues: input.issues ?? [],
  };
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  // Page versions: the first import saves v1 (every component's default); a re-import keeps them.
  const versionsDir = join(dir, 'versions');
  const existing = savedVersions(root, input.id);
  let scaffoldedVersion = false;
  if (existing.length === 0) {
    const motionMap = Object.fromEntries(components.map(c => [c.id, defaultVersionOf(root, c.component)]));
    mkdirSync(versionsDir, { recursive: true });
    writeFileSync(join(versionsDir, 'v1.json'), serializePageVersion({ id: 'v1', label: 'Default', motionMap }));
    scaffoldedVersion = true;
  }

  const stale = scaffoldedVersion ? [] : checkPageVersions(existing, page, moduleStubs(root, components.map(c => c.component)));
  return { pageDir: dir, scaffoldedVersion, slots: ids, staleVersions: stale };
}

/** Returns a list of problems with an imported page folder (empty = valid). */
export function validateImportedPage(root: string, id: string): string[] {
  const dir = join(root, 'pages', id);
  const errors: string[] = [];
  for (const f of ['page.json', 'meta.json', 'versions/v1.json']) {
    if (!existsSync(join(dir, f))) errors.push(`missing ${f}`);
  }
  if (errors.length) return errors;

  const page = JSON.parse(readFileSync(join(dir, 'page.json'), 'utf8')) as Partial<PageConfig>;
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as Partial<PageMeta>;
  if (page.id !== id) errors.push('page.json id does not match folder');
  if (!page.title) errors.push('page.json missing title');
  if (!(page.width && page.width > 0)) errors.push('page.json missing width');
  if (!page.components?.length) { errors.push('page.json has no components'); return errors; }
  if (!meta.figma?.url?.startsWith('https://www.figma.com/')) errors.push('meta.json missing figma.url');
  if (!meta.importedAt || Number.isNaN(Date.parse(meta.importedAt))) errors.push('meta.json missing importedAt');
  if (!meta.frame?.width || !meta.frame?.height) errors.push('meta.json missing frame size');

  const slots = page.components.map(c => c.id);
  if (new Set(slots).size !== slots.length) errors.push('page.json has duplicate component ids');
  for (const c of page.components) {
    if (!existsSync(join(root, 'components', c.component, 'motion.ts'))) errors.push(`component not found: ${c.component}`);
  }
  if (errors.length) return errors;

  try {
    errors.push(...checkPageVersions(savedVersions(root, id), page as PageConfig, moduleStubs(root, page.components.map(c => c.component))));
  } catch (e) {
    errors.push((e as Error).message);
  }
  return errors;
}
