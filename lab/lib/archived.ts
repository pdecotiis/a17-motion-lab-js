// Archived component versions. A version is archived by naming it in `components/<name>/archived.json` (`{ "versions": ["v3"] }`), a file next to
// the component, not in the version file: a version file is the designer's authored motion and the lab never edits it. The dev server writes the
// file when Archive or Unarchive is clicked (scripts/version-archive-save.ts); the lab reads it at startup and marks those versions `archived`.
// An archived version stays where it is, disabled; nothing is deleted. Pure: no files here.
import type { MotionVersion } from './types.js';

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
