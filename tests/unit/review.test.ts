import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewIdsOf, withReview, serializeReview, reviewEntries, reviewListText, reviewHref } from '../../lab/lib/review.js';
import { setPageVersionReview } from '../../scripts/review-save.js';
import { handleReviewRequest } from '../../scripts/review-plugin.js';

describe('the review list', () => {
  it('reads version ids only, in order, without repeats', () => {
    expect(reviewIdsOf({ versions: ['v12', 'v2', 'v2', 'x', 3] })).toEqual(['v2', 'v12']);
    expect(reviewIdsOf(null)).toEqual([]);
  });
  it('marks and unmarks, and writes nothing when empty', () => {
    expect(withReview(['v2'], 'v1', true)).toEqual(['v1', 'v2']);
    expect(withReview(['v1', 'v2'], 'v1', false)).toEqual(['v2']);
    expect(serializeReview([])).toBe('');
    expect(JSON.parse(serializeReview(['v1']))).toEqual({ versions: ['v1'] });
  });
  it('gathers marked versions, leaving out archived and missing ones', () => {
    const pages = [
      { id: 'b', title: 'B page', archived: false, versions: [{ id: 'v1', label: 'One' }, { id: 'v2', label: 'Two' }] },
      { id: 'a', title: 'A page', archived: false, versions: [{ id: 'v1', label: 'Uno' }] },
      { id: 'c', title: 'C', archived: true, versions: [{ id: 'v1', label: 'x' }] },
    ];
    const marked = new Map([['b', new Set(['v1', 'v2', 'v9'])], ['a', new Set(['v1'])], ['c', new Set(['v1'])]]);
    const got = reviewEntries(pages, marked, new Map([['b', new Set(['v2'])]]));
    expect(got.map(e => `${e.page} ${e.version}`)).toEqual(['a v1', 'b v1']);
    expect(got[0]!.href).toBe('?view=page&page=a&pv=v1&preview=1');
    expect(reviewListText(got)).toContain('A page v1: Uno\n?view=page&page=a&pv=v1&preview=1');
    expect(reviewHref('a', 'v2', 'http://x/')).toBe('http://x/?view=page&page=a&pv=v2&preview=1');
  });
});

describe('saving a mark', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'review-'));
    mkdirSync(join(root, 'pages', 'home', 'versions'), { recursive: true });
    writeFileSync(join(root, 'pages', 'home', 'page.json'), '{}');
    for (const v of ['v1', 'v2']) writeFileSync(join(root, 'pages', 'home', 'versions', `${v}.json`), '{}');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const file = (): string => join(root, 'pages', 'home', 'review.json');
  it('writes review.json, removes it when empty, and leaves page.json alone', () => {
    expect(setPageVersionReview(root, { page: 'home', version: 'v2', ready: true })).toEqual(['v2']);
    expect(JSON.parse(readFileSync(file(), 'utf8'))).toEqual({ versions: ['v2'] });
    expect(setPageVersionReview(root, { page: 'home', version: 'v1', ready: true })).toEqual(['v1', 'v2']);
    setPageVersionReview(root, { page: 'home', version: 'v1', ready: false });
    setPageVersionReview(root, { page: 'home', version: 'v2', ready: false });
    expect(existsSync(file())).toBe(false);
    expect(readFileSync(join(root, 'pages', 'home', 'page.json'), 'utf8')).toBe('{}');
  });
  it('refuses a version that is not saved, a bad name or a missing page', () => {
    expect(() => setPageVersionReview(root, { page: 'home', version: 'v9', ready: true })).toThrow(/no saved version/);
    expect(() => setPageVersionReview(root, { page: '../x', version: 'v1', ready: true })).toThrow(/not valid/);
    expect(() => setPageVersionReview(root, { page: 'nope', version: 'v1', ready: true })).toThrow(/no page/);
  });
  it('the endpoint answers GET, refuses other sites and bad bodies', () => {
    expect(handleReviewRequest(root, { method: 'GET' }).body).toEqual({ available: true });
    expect(handleReviewRequest(root, { method: 'POST', origin: 'http://evil.test', host: 'localhost:5173', body: '{}' }).status).toBe(403);
    expect(handleReviewRequest(root, { method: 'POST', body: '{"page":"home"}' }).status).toBe(400);
    expect(handleReviewRequest(root, { method: 'POST', body: JSON.stringify({ page: 'home', version: 'v1', ready: true }) })).toEqual({ status: 200, body: { marked: ['v1'] } });
  });
});
