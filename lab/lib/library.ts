import type { ComponentModule, ComponentStatus, MotionVersion } from './types.js';
import { componentPasses, filterFromParams, getComponentStatus, type ComponentFilter } from './version-meta.js';

export interface LibraryFilter extends ComponentFilter {
  /** Case-insensitive match against the component name (hyphens count as spaces). */
  query?: string;
}

export interface LibraryEntry {
  name: string;
  /** Version the card previews: the component's default if it is visible, else the first visible one. */
  previewVersion: MotionVersion;
  /** The component's status (approval is the component's, not a version's). */
  status: ComponentStatus;
  totalVersions: number;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/-/g, ' ').trim();
}

// A component is listed when its name matches the query and its status passes the
// filter (archived components are hidden by default).
export function buildLibraryEntries(
  modules: Record<string, ComponentModule>,
  filter: LibraryFilter = {},
): LibraryEntry[] {
  const query = normalize(filter.query ?? '');
  const entries: LibraryEntry[] = [];
  for (const name of Object.keys(modules).sort()) {
    const module = modules[name]!;
    if (query && !normalize(name).includes(query)) continue;
    if (!componentPasses(module, filter) || module.versions.length === 0) continue;
    const previewVersion = module.versions.find(v => v.id === module.defaultVersion) ?? module.versions[0]!;
    entries.push({ name, previewVersion, status: getComponentStatus(module), totalVersions: module.versions.length });
  }
  return entries;
}

// ?status=…&archived=1&q=…
export function libraryFilterFromParams(params: URLSearchParams): LibraryFilter {
  return { ...filterFromParams(params), query: params.get('q') ?? '' };
}
