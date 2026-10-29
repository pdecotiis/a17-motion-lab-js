import type { ComponentModule, MotionVersion } from './types.js';
import { filterFromParams, filterVersions, type VersionFilter } from './version-meta.js';

export interface LibraryFilter extends VersionFilter {
  /** Case-insensitive match against the component name (hyphens count as spaces). */
  query?: string;
}

export interface LibraryEntry {
  name: string;
  /** Version the card previews: the component's default if it is visible, else the first visible one. */
  previewVersion: MotionVersion;
  /** Versions that pass the status filter. */
  visibleVersions: MotionVersion[];
  /** All versions, regardless of the filter. */
  totalVersions: number;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/-/g, ' ').trim();
}

// A component is listed when its name matches the query and at least one of its
// versions passes the status filter (archived versions are hidden by default).
export function buildLibraryEntries(
  modules: Record<string, ComponentModule>,
  filter: LibraryFilter = {},
): LibraryEntry[] {
  const query = normalize(filter.query ?? '');
  const entries: LibraryEntry[] = [];
  for (const name of Object.keys(modules).sort()) {
    const module = modules[name]!;
    if (query && !normalize(name).includes(query)) continue;
    const visibleVersions = filterVersions(module.versions, filter);
    if (visibleVersions.length === 0) continue;
    const previewVersion =
      visibleVersions.find(v => v.id === module.defaultVersion) ?? visibleVersions[0]!;
    entries.push({ name, previewVersion, visibleVersions, totalVersions: module.versions.length });
  }
  return entries;
}

// ?status=…&archived=1&q=…
export function libraryFilterFromParams(params: URLSearchParams): LibraryFilter {
  return { ...filterFromParams(params), query: params.get('q') ?? '' };
}
