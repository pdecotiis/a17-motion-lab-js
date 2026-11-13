/**
 * Archives or unarchives a whole component, a whole page, or a page's version (the file-writing half of the lab's Archive buttons; see archive-plugin.ts).
 *   components/<name>/archived.json  { "component": true }  and/or { "versions": [...] }   (versions: scripts/version-archive-save.ts)
 *   pages/<id>/archived.json         { "page": true }       and/or { "versions": ["v3"] }
 * It writes only that one small file, never touches motion.ts, page.json or a version file, and keeps the file's other lines as they were.
 * Claude can call these directly.
 */
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARCHIVE_FILE, parseArchiveFile, serializeArchiveFile, withArchived, type ArchiveFile } from '../lab/lib/archived.js';

const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;

export function readArchiveFile(dir: string): ArchiveFile {
  const file = join(dir, ARCHIVE_FILE);
  if (!existsSync(file)) return { versions: [], component: false, page: false };
  try { return parseArchiveFile(JSON.parse(readFileSync(file, 'utf8'))); } catch { return { versions: [], component: false, page: false }; }
}

/** Write the file, or remove it when nothing is archived any more. */
export function writeArchiveFile(dir: string, content: ArchiveFile): void {
  const file = join(dir, ARCHIVE_FILE);
  const text = serializeArchiveFile(content);
  if (text === '') { if (existsSync(file)) unlinkSync(file); } else writeFileSync(file, text);
}

export function setComponentArchived(root: string, input: { component: string; archived: boolean }): boolean {
  if (!SAFE_NAME.test(input.component)) throw new Error('That component name is not valid.');
  const dir = join(root, 'components', input.component);
  if (!existsSync(join(dir, 'motion.ts'))) throw new Error(`There is no component "${input.component}".`);
  writeArchiveFile(dir, { ...readArchiveFile(dir), component: input.archived });
  return input.archived;
}

export function setPageArchived(root: string, input: { page: string; archived: boolean }): boolean {
  if (!SAFE_NAME.test(input.page)) throw new Error('That page name is not valid.');
  const dir = join(root, 'pages', input.page);
  if (!existsSync(join(dir, 'page.json'))) throw new Error(`There is no page "${input.page}".`);
  writeArchiveFile(dir, { ...readArchiveFile(dir), page: input.archived });
  return input.archived;
}

/** The saved page versions that exist as files in pages/<page>/versions/. */
export function pageVersionIdsOf(root: string, page: string): string[] {
  const dir = join(root, 'pages', page, 'versions');
  return existsSync(dir) ? readdirSync(dir).filter(f => /^v\d+\.json$/.test(f)).map(f => f.replace(/\.json$/, '')) : [];
}

export function setPageVersionArchived(root: string, input: { page: string; version: string; archived: boolean }): string[] {
  if (!SAFE_NAME.test(input.page)) throw new Error('That page name is not valid.');
  const dir = join(root, 'pages', input.page);
  if (!existsSync(join(dir, 'page.json'))) throw new Error(`There is no page "${input.page}".`);
  const all = pageVersionIdsOf(root, input.page);
  if (!all.includes(input.version)) throw new Error(`Page "${input.page}" has no saved version "${input.version}".`);
  const file = readArchiveFile(dir);
  const next = withArchived(file.versions.filter(v => all.includes(v)), input.version, input.archived);
  if (input.archived && all.every(v => next.includes(v))) throw new Error('Keep at least one version in play: this is the last one.');
  writeArchiveFile(dir, { ...file, versions: next });
  return next;
}
