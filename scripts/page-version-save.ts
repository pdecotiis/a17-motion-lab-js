/**
 * Saves a page version: pages/<page>/versions/v<next>.json, or, with `overwrite`, over the one version named.
 * The file-writing half of the Page view's "Save as new version" and "Save" buttons (see page-version-plugin.ts);
 * Claude can call it too. A new version writes only one new file and never replaces an existing one. Saving over replaces
 * only the version you name, and only its motion map and stagger: its id, its name and where it was forked from stay.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  nextPageVersionId, serializePageVersion, validatePageVersion, type PageVersion,
} from '../lab/lib/page-versions.js';
import type { MotionMap, PageConfig } from '../lab/lib/types.js';

export interface SavePageVersionInput {
  page: string;
  /** The new version's name; not needed when saving over (the version keeps its own). */
  label?: string | undefined;
  /** Save over this existing version (`v3`) instead of creating the next one. */
  overwrite?: string | undefined;
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

  // Saving over: the named version must be a saved file; its name and lineage stay, its motion map and stagger are replaced.
  if (input.overwrite !== undefined) {
    if (!/^v\d+$/.test(input.overwrite) || !existing.some(v => v.id === input.overwrite)) throw new Error(`There is no saved version "${input.overwrite}" to save over.`);
    const file = join(root, 'pages', input.page, 'versions', `${input.overwrite}.json`);
    const before = validatePageVersion(JSON.parse(readFileSync(file, 'utf8')));
    const after = validatePageVersion({
      id: before.id,
      label: before.label,
      motionMap: input.motionMap,
      ...(input.stagger !== undefined ? { stagger: input.stagger } : {}),
      ...(before.forkedFrom !== undefined ? { forkedFrom: before.forkedFrom } : {}),
    });
    writeFileSync(file, serializePageVersion(after));
    return after;
  }
  if (input.label === undefined) throw new Error('Give the new version a name.');

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
