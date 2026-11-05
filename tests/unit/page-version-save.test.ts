import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { savePageVersion, savedPageVersionIds } from '../../scripts/page-version-save.js';
import { handlePageVersionRequest } from '../../scripts/page-version-plugin.js';

// A generic page and two components in a temp folder; nothing from a real project.
let root: string;

function write(rel: string, content: string): void {
  const path = join(root, rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'page-versions-'));
  write('pages/home/page.json', JSON.stringify({
    id: 'home', title: 'Home',
    components: [{ id: 'hero', component: 'hero' }, { id: 'card-1', component: 'card' }],
  }));
  for (const v of ['v1', 'v2']) write(`components/hero/versions/${v}.ts`, '');
  write('components/card/versions/v1.ts', '');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('savePageVersion', () => {
  it('writes the next free version file and returns it', () => {
    const first = savePageVersion(root, { page: 'home', label: 'Quiet', motionMap: { hero: 'v1', 'card-1': 'v1' } });
    expect(first.id).toBe('v1');
    const second = savePageVersion(root, { page: 'home', label: 'Layered', motionMap: { hero: 'v2' }, stagger: 'delay.120', forkedFrom: 'v1' });
    expect(second).toEqual({ id: 'v2', label: 'Layered', motionMap: { hero: 'v2' }, stagger: 'delay.120', forkedFrom: 'v1' });
    expect(savedPageVersionIds(root, 'home').sort()).toEqual(['v1', 'v2']);
    expect(JSON.parse(readFileSync(join(root, 'pages/home/versions/v2.json'), 'utf8'))).toEqual(second);
  });

  it('never replaces an existing version', () => {
    savePageVersion(root, { page: 'home', label: 'A', motionMap: {} });
    const before = readFileSync(join(root, 'pages/home/versions/v1.json'), 'utf8');
    savePageVersion(root, { page: 'home', label: 'B', motionMap: {} });
    expect(readFileSync(join(root, 'pages/home/versions/v1.json'), 'utf8')).toBe(before);
  });

  it('ignores a forkedFrom that is not a saved version', () => {
    expect(savePageVersion(root, { page: 'home', label: 'A', motionMap: {}, forkedFrom: 'v1' }).forkedFrom).toBeUndefined();
  });

  it('refuses a slot not on the page and a component version that does not exist', () => {
    expect(() => savePageVersion(root, { page: 'home', label: 'A', motionMap: { nope: 'v1' } })).toThrow('not on page');
    expect(() => savePageVersion(root, { page: 'home', label: 'A', motionMap: { 'card-1': 'v2' } })).toThrow('no version "v2"');
    expect(existsSync(join(root, 'pages/home/versions'))).toBe(false);
  });

  it('refuses a missing page, a path-like page name and a bad stagger or label', () => {
    expect(() => savePageVersion(root, { page: 'about', label: 'A', motionMap: {} })).toThrow('no page');
    expect(() => savePageVersion(root, { page: '../x', label: 'A', motionMap: {} })).toThrow('not valid');
    expect(() => savePageVersion(root, { page: 'home', label: 'A', motionMap: {}, stagger: '120' })).toThrow('stagger');
    expect(() => savePageVersion(root, { page: 'home', label: '  ', motionMap: {} })).toThrow('label');
    expect(() => savePageVersion(root, { page: 'home', label: 'x'.repeat(81), motionMap: {} })).toThrow('80');
  });
});

describe('the dev endpoint', () => {
  const post = (body: unknown, extra: Record<string, string> = {}) =>
    handlePageVersionRequest(root, { method: 'POST', host: 'localhost:5173', origin: 'http://localhost:5173', body: JSON.stringify(body), ...extra });

  it('says it is available on GET', () => {
    expect(handlePageVersionRequest(root, { method: 'GET', host: 'localhost:5173' })).toEqual({ status: 200, body: { available: true } });
  });

  it('saves on POST and returns the id', () => {
    expect(post({ page: 'home', label: 'A', motionMap: { hero: 'v2' } })).toEqual({ status: 200, body: { id: 'v1' } });
    expect(existsSync(join(root, 'pages/home/versions/v1.json'))).toBe(true);
  });

  it('refuses a request from another site, other methods and bad input', () => {
    expect(post({ page: 'home', label: 'A', motionMap: {} }, { origin: 'https://evil.example' }).status).toBe(403);
    expect(handlePageVersionRequest(root, { method: 'DELETE', host: 'localhost:5173' }).status).toBe(405);
    expect(handlePageVersionRequest(root, { method: 'POST', body: 'not json' }).status).toBe(400);
    expect(post({ page: 'home', motionMap: {} }).status).toBe(400);
    expect(post({ page: 'home', label: 'A', motionMap: { nope: 'v1' } }).status).toBe(400);
    expect(existsSync(join(root, 'pages/home/versions'))).toBe(false);
  });
});
