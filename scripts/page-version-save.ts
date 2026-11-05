/**
 * Saves a page version: pages/<page>/versions/v<next>.json.
 * The file-writing half of the Page view's "Save as new version" button (see page-version-plugin.ts);
 * Claude can call it too. It writes only that one new file and never replaces an existing version.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  nextPageVersionId, serializePageVersion, validatePageVersion, type PageVersion,
} from '../lab/lib/page-versions.js';
import type { MotionMap, PageConfig } from '../lab/lib/types.js';

export interface SavePageVersionInput {
  page: string;
  label: string;
  motionMap: MotionMap;
  stagger?: string | undefined;
  forkedFrom?: string | undefined;
}

const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Version ids that exist as files in pages/<page>/versions/. */
export function savedPageVersionIds(root: string, page: string): string[] {
  const dir = join(root, 'pages', page, 'versions');
  return existsSync(dir) ? readdirSync(dir).filter(f => /^v\d+\.json$/.test(f)).map(f => f.replace(/\.json$/, '')) : [];
}

export function savePageVersion(root: string, input: SavePageVersionInput): PageVersion {
  if (!SAFE_NAME.test(input.page)) throw new Error('That page name is not valid.');
  const pagePath = join(root, 'pages', input.page, 'page.json');
  if (!existsSync(pagePath)) throw new Error(`There is no page "${input.page}".`);
  const page = JSON.parse(readFileSync(pagePath, 'utf8')) as PageConfig;

  // Each choice must be a slot on the page and a version file of that slot's component.
  const slots = new Map(page.components.map(c => [c.id, c.component]));
  for (const [slot, versionId] of Object.entries(input.motionMap)) {
    const component = slots.get(slot);
    if (component === undefined) throw new Error(`"${slot}" is not on page "${input.page}".`);
    if (!SAFE_NAME.test(component) || !existsSync(join(root, 'components', component, 'versions', `${versionId}.ts`))) {
      throw new Error(`Component "${component}" has no version "${versionId}".`);
    }
  }

  const existing = savedPageVersionIds(root, input.page).map(id => ({ id }));
  const forkedFrom = input.forkedFrom && existing.some(v => v.id === input.forkedFrom) ? input.forkedFrom : undefined;
  const version = validatePageVersion({
    id: nextPageVersionId(existing),
    label: input.label,
    motionMap: input.motionMap,
    ...(input.stagger !== undefined ? { stagger: input.stagger } : {}),
    ...(forkedFrom !== undefined ? { forkedFrom } : {}),
  });
  if (version.label.length > 80) throw new Error('Keep the name under 80 characters.');

  const dir = join(root, 'pages', input.page, 'versions');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${version.id}.json`), serializePageVersion(version));
  return version;
}
