/**
 * Marks a page version ready for review, or takes the mark off (the file-writing half of the lab's Ready for review button; see review-plugin.ts).
 *   pages/<id>/review.json  { "versions": ["v11", "v12"] }   (removed when nothing is marked)
 * It writes only that one small file, never touches page.json or a version file. Claude can call setPageVersionReview directly.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REVIEW_FILE, reviewIdsOf, serializeReview, withReview } from '../lab/lib/review.js';
import { pageVersionIdsOf } from './archive-save.js';

const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;

export function readReviewFile(dir: string): string[] {
  const file = join(dir, REVIEW_FILE);
  if (!existsSync(file)) return [];
  try { return reviewIdsOf(JSON.parse(readFileSync(file, 'utf8'))); } catch { return []; }
}

/** Mark (ready true) or unmark a saved page version; returns the marked ids of that page. */
export function setPageVersionReview(root: string, input: { page: string; version: string; ready: boolean }): string[] {
  if (!SAFE_NAME.test(input.page)) throw new Error('That page name is not valid.');
  const dir = join(root, 'pages', input.page);
  if (!existsSync(join(dir, 'page.json'))) throw new Error(`There is no page "${input.page}".`);
  const all = pageVersionIdsOf(root, input.page);
  if (input.ready && !all.includes(input.version)) throw new Error(`Page "${input.page}" has no saved version "${input.version}": save it first.`);
  const next = withReview(readReviewFile(dir).filter(v => all.includes(v) || v === input.version), input.version, input.ready);
  const text = serializeReview(next);
  const file = join(dir, REVIEW_FILE);
  if (text === '') { if (existsSync(file)) unlinkSync(file); } else writeFileSync(file, text);
  return next;
}
