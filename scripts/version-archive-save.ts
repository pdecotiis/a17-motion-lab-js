/**
 * Archives or unarchives a component version: components/<component>/archived.json (see lab/lib/archived.ts).
 * The file-writing half of the component view's Archive button (see version-archive-plugin.ts). It writes only that one small file, never touches
 * a version file, and refuses to archive the last version still in play.
 */
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARCHIVE_FILE, archivedIdsOf, serializeArchived, withArchived } from '../lab/lib/archived.js';

export interface ArchiveInput {
  component: string;
  version: string;
  archived: boolean;
}

const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;

/** The version ids that exist as files in components/<component>/versions/. */
export function versionIdsOf(root: string, component: string): string[] {
  const dir = join(root, 'components', component, 'versions');
  return existsSync(dir) ? readdirSync(dir).filter(f => /^v\d+\.ts$/.test(f)).map(f => f.replace(/\.ts$/, '')) : [];
}

/** The versions archived now. */
export function archivedVersions(root: string, component: string): string[] {
  const file = join(root, 'components', component, ARCHIVE_FILE);
  if (!existsSync(file)) return [];
  try { return archivedIdsOf(JSON.parse(readFileSync(file, 'utf8'))); } catch { return []; }
}

export function setVersionArchived(root: string, input: ArchiveInput): string[] {
  if (!SAFE_NAME.test(input.component)) throw new Error('That component name is not valid.');
  const all = versionIdsOf(root, input.component);
  if (all.length === 0) throw new Error(`There is no component "${input.component}".`);
  if (!all.includes(input.version)) throw new Error(`Component "${input.component}" has no version "${input.version}".`);
  const now = archivedVersions(root, input.component).filter(v => all.includes(v));
  const next = withArchived(now, input.version, input.archived);
  if (input.archived && all.every(v => next.includes(v))) throw new Error('Keep at least one version in play: this is the last one.');
  const file = join(root, 'components', input.component, ARCHIVE_FILE);
  if (next.length === 0) { if (existsSync(file)) unlinkSync(file); } else writeFileSync(file, serializeArchived(next));
  return next;
}
