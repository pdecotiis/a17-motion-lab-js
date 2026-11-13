// Archived component versions. A version is archived by naming it in `components/<name>/archived.json` (`{ "versions": ["v3"] }`), a file next to
// the component, not in the version file: a version file is the designer's authored motion and the lab never edits it. The dev server writes the
// file when Archive or Unarchive is clicked (scripts/version-archive-save.ts); the lab reads it at startup and marks those versions `archived`.
// An archived version stays where it is, disabled; nothing is deleted. Pure: no files here.
import type { ComponentModule, MotionVersion } from './types.js';

export const ARCHIVE_FILE = 'archived.json';
const VERSION_ID = /^v\d+$/;
const num = (id: string): number => Number(id.slice(1));

/** The version ids a parsed archived.json names (anything that is not a version id is ignored). */
export function archivedIdsOf(config: unknown): string[] {
  if (typeof config !== 'object' || config === null) return [];
  const list = (config as { versions?: unknown }).versions;
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((v): v is string => typeof v === 'string' && VERSION_ID.test(v)))].sort((a, b) => num(a) - num(b));
}

/** The list with `id` archived or, with `archived` false, taken out. */
export function withArchived(ids: string[], id: string, archived: boolean): string[] {
  const rest = ids.filter(v => v !== id);
  return (archived ? [...rest, id] : rest).sort((a, b) => num(a) - num(b));
}

export function serializeArchived(ids: string[]): string {
  return JSON.stringify({ versions: ids }, null, 2) + '\n';
}

export const isArchived = (v: { archived?: boolean | undefined }): boolean => v.archived === true;

/** The versions still in play, in order. */
export const activeVersions = <T extends { archived?: boolean | undefined }>(versions: T[]): T[] => versions.filter(v => !isArchived(v));

/** Mark the versions a component's archived.json names (and clear the mark on the others). */
export function applyArchived(versions: MotionVersion[], ids: string[]): void {
  for (const v of versions) {
    if (ids.includes(v.id)) v.archived = true; else delete v.archived;
  }
}

// ── Whole components, whole pages, and page versions ───────────────────────────────────────────────────────────────────
// The same file carries more than the version list. `components/<name>/archived.json` may also say `"component": true` (the whole component is archived),
// `pages/<id>/archived.json` says `"page": true` (the whole page) and/or `"versions": ["v3"]` (page versions). Nothing authored is ever edited: the
// lab marks what the file names at startup and Unarchive just takes the line out.
export interface ArchiveFile { versions: string[]; component: boolean; page: boolean }

export function parseArchiveFile(config: unknown): ArchiveFile {
  const flag = (key: string): boolean => typeof config === 'object' && config !== null && (config as Record<string, unknown>)[key] === true;
  return { versions: archivedIdsOf(config), component: flag('component'), page: flag('page') };
}

/** The file's text, or '' when nothing is archived any more (the file is then removed). */
export function serializeArchiveFile(file: ArchiveFile): string {
  const out: Record<string, unknown> = {};
  if (file.component) out['component'] = true;
  if (file.page) out['page'] = true;
  if (file.versions.length > 0) out['versions'] = file.versions;
  return Object.keys(out).length === 0 ? '' : JSON.stringify(out, null, 2) + '\n';
}

const baseStatuses = new WeakMap<object, ComponentModule['status']>();
/** Mark a component archived (its status reads `archived`), or restore whatever status its motion.ts has. */
export function applyComponentArchived(module: ComponentModule, archived: boolean): void {
  if (!baseStatuses.has(module)) baseStatuses.set(module, module.status);
  const base = baseStatuses.get(module);
  if (archived) module.status = 'archived';
  else if (base === undefined) delete module.status; else module.status = base;
}

/** Is a page listed? Archived pages are hidden unless "Show archived" is on. */
export const pagePasses = (archived: boolean, showArchived: boolean): boolean => showArchived || !archived;

/** The page versions still in play (those not named in the page's archived list), in order. */
export const pageVersionsInPlay = <T extends { id: string }>(versions: T[], archivedIds: ReadonlySet<string>): T[] => versions.filter(v => !archivedIds.has(v.id));

/** Where the page view goes when the version on screen was just archived: the default (the first), else the first still in play. */
export function nextPageVersion(versions: { id: string }[], archivedIds: ReadonlySet<string>): string | undefined {
  const inPlay = pageVersionsInPlay(versions, archivedIds);
  return inPlay[0]?.id;
}
