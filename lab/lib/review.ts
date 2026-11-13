// "Ready for review": a page version is marked by naming it in `pages/<id>/review.json` (`{ "versions": ["v11", "v12"] }`), a small file next to the
// page, never in page.json or a version file. The dev server writes it (scripts/review-save.ts); the lab reads it at startup. The For review list in
// the Pages library gathers the marked versions, with a link to each in preview mode, so they can be pasted to the client or the team. Pure: no files here.
export const REVIEW_FILE = 'review.json';
const VERSION_ID = /^v\d+$/;
const num = (id: string): number => Number(id.slice(1));

/** The version ids a parsed review.json names (anything that is not a version id is ignored), in order. */
export function reviewIdsOf(config: unknown): string[] {
  if (typeof config !== 'object' || config === null) return [];
  const list = (config as { versions?: unknown }).versions;
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((v): v is string => typeof v === 'string' && VERSION_ID.test(v)))].sort((a, b) => num(a) - num(b));
}

/** The list with `id` marked or, with `ready` false, taken out. */
export function withReview(ids: string[], id: string, ready: boolean): string[] {
  const rest = ids.filter(v => v !== id);
  return (ready ? [...rest, id] : rest).sort((a, b) => num(a) - num(b));
}

/** The file's text, or '' when nothing is marked any more (the file is then removed). */
export function serializeReview(ids: string[]): string {
  return ids.length === 0 ? '' : JSON.stringify({ versions: ids }, null, 2) + '\n';
}

export interface ReviewEntry { page: string; pageTitle: string; version: string; label: string; href: string }

/** The preview link of a page version, relative to the lab's address (`base` is the lab's page without any query). */
export const reviewHref = (page: string, version: string, base = ''): string => `${base}?view=page&page=${encodeURIComponent(page)}&pv=${encodeURIComponent(version)}&preview=1`;

interface PageInfo { id: string; title: string; versions: { id: string; label: string }[]; archived: boolean }

/** Every marked page version, pages in name order and versions in order. A marked version that no longer exists, or that is archived (itself or its page), is left out. */
export function reviewEntries(pages: PageInfo[], marked: ReadonlyMap<string, ReadonlySet<string>>, archivedVersions: ReadonlyMap<string, ReadonlySet<string>>, base = ''): ReviewEntry[] {
  const out: ReviewEntry[] = [];
  for (const p of [...pages].sort((a, b) => a.id.localeCompare(b.id))) {
    if (p.archived) continue;
    const ids = marked.get(p.id);
    if (!ids) continue;
    for (const v of p.versions) {
      if (ids.has(v.id) && !archivedVersions.get(p.id)?.has(v.id)) out.push({ page: p.id, pageTitle: p.title || p.id, version: v.id, label: v.label, href: reviewHref(p.id, v.id, base) });
    }
  }
  return out;
}

/** One entry as a short block of text for a message: its name, its label and the link. */
export const reviewEntryText = (e: ReviewEntry): string => `${e.pageTitle} ${e.version}: ${e.label}\n${e.href}`;

/** The whole list as text to paste: a heading and one block per version. */
export const reviewListText = (entries: ReviewEntry[]): string => ['Ready for review', ...entries.map(reviewEntryText)].join('\n\n');
