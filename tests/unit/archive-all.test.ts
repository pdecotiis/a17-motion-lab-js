import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArchiveFile, serializeArchiveFile, applyComponentArchived, pagePasses, pageVersionsInPlay, nextPageVersion } from '../../lab/lib/archived.js';
import { setComponentArchived, setPageArchived, setPageVersionArchived } from '../../scripts/archive-save.js';
import { setVersionArchived } from '../../scripts/version-archive-save.js';
import { handleArchiveRequest } from '../../scripts/archive-plugin.js';
import { buildLibraryEntries } from '../../lab/lib/library.js';
import type { ComponentModule, MotionVersion } from '../../lab/lib/types.js';

describe('the archive file for components and pages', () => {
  it('reads the component and page flags and the versions, ignoring anything else', () => {
    expect(parseArchiveFile({ component: true, versions: ['v2'] })).toEqual({ component: true, page: false, versions: ['v2'] });
    expect(parseArchiveFile({ page: true, component: 'yes' })).toEqual({ component: false, page: true, versions: [] });
    expect(parseArchiveFile(null)).toEqual({ component: false, page: false, versions: [] });
  });
  it('writes only what is archived, and nothing when nothing is', () => {
    expect(serializeArchiveFile({ component: false, page: false, versions: [] })).toBe('');
    expect(JSON.parse(serializeArchiveFile({ component: true, page: false, versions: ['v1'] }))).toEqual({ component: true, versions: ['v1'] });
  });
  it('marks a component archived and restores its own status', () => {
    const mod = { versions: [], defaultVersion: 'v1', status: 'review' } as ComponentModule;
    applyComponentArchived(mod, true);
    expect(mod.status).toBe('archived');
    applyComponentArchived(mod, false);
    expect(mod.status).toBe('review');
    const plain = { versions: [], defaultVersion: 'v1' } as ComponentModule;
    applyComponentArchived(plain, true);
    applyComponentArchived(plain, false);
    expect('status' in plain).toBe(false);
  });
  it('an archived component stays in the Library behind Show archived', () => {
    const v = [{ id: 'v1', label: 'v1', lineage: 'x' } as MotionVersion];
    const mod = { versions: v, defaultVersion: 'v1' } as ComponentModule;
    applyComponentArchived(mod, true);
    expect(buildLibraryEntries({ a: mod }).length).toBe(0);
    expect(buildLibraryEntries({ a: mod }, { showArchived: true }).length).toBe(1);
  });
  it('pages and page versions in play', () => {
    expect(pagePasses(true, false)).toBe(false);
    expect(pagePasses(true, true)).toBe(true);
    expect(pagePasses(false, false)).toBe(true);
    const all = [{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }];
    expect(pageVersionsInPlay(all, new Set(['v1'])).map(v => v.id)).toEqual(['v2', 'v3']);
    expect(nextPageVersion(all, new Set(['v1']))).toBe('v2');
    expect(nextPageVersion(all, new Set(['v1', 'v2', 'v3']))).toBeUndefined();
  });
});

describe('saving component, page and page version archives', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'archive-all-'));
    mkdirSync(join(root, 'components/card/versions'), { recursive: true });
    writeFileSync(join(root, 'components/card/motion.ts'), 'AUTHORED');
    writeFileSync(join(root, 'components/card/versions/v1.ts'), '');
    writeFileSync(join(root, 'components/card/versions/v2.ts'), '');
    mkdirSync(join(root, 'pages/home/versions'), { recursive: true });
    writeFileSync(join(root, 'pages/home/page.json'), '{"id":"home"}');
    for (const v of ['v1', 'v2', 'v3']) writeFileSync(join(root, `pages/home/versions/${v}.json`), '{}');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const cfile = (): string => join(root, 'components/card/archived.json');
  const pfile = (): string => join(root, 'pages/home/archived.json');

  it('archives a component without touching motion.ts, and unarchive removes the file', () => {
    expect(setComponentArchived(root, { component: 'card', archived: true })).toBe(true);
    expect(JSON.parse(readFileSync(cfile(), 'utf8'))).toEqual({ component: true });
    expect(readFileSync(join(root, 'components/card/motion.ts'), 'utf8')).toBe('AUTHORED');
    setComponentArchived(root, { component: 'card', archived: false });
    expect(existsSync(cfile())).toBe(false);
  });
  it('keeps the component flag and the version list apart', () => {
    setVersionArchived(root, { component: 'card', version: 'v2', archived: true });
    setComponentArchived(root, { component: 'card', archived: true });
    expect(JSON.parse(readFileSync(cfile(), 'utf8'))).toEqual({ component: true, versions: ['v2'] });
    setComponentArchived(root, { component: 'card', archived: false });
    expect(JSON.parse(readFileSync(cfile(), 'utf8'))).toEqual({ versions: ['v2'] });
    setVersionArchived(root, { component: 'card', version: 'v2', archived: false });
    setComponentArchived(root, { component: 'card', archived: true });
    setVersionArchived(root, { component: 'card', version: 'v1', archived: true });
    expect(JSON.parse(readFileSync(cfile(), 'utf8'))).toEqual({ component: true, versions: ['v1'] });
  });
  it('archives a page and its versions in one file, never touching page.json or a version file', () => {
    setPageArchived(root, { page: 'home', archived: true });
    expect(setPageVersionArchived(root, { page: 'home', version: 'v2', archived: true })).toEqual(['v2']);
    expect(JSON.parse(readFileSync(pfile(), 'utf8'))).toEqual({ page: true, versions: ['v2'] });
    expect(readFileSync(join(root, 'pages/home/page.json'), 'utf8')).toBe('{"id":"home"}');
    expect(readFileSync(join(root, 'pages/home/versions/v2.json'), 'utf8')).toBe('{}');
    setPageArchived(root, { page: 'home', archived: false });
    expect(JSON.parse(readFileSync(pfile(), 'utf8'))).toEqual({ versions: ['v2'] });
    setPageVersionArchived(root, { page: 'home', version: 'v2', archived: false });
    expect(existsSync(pfile())).toBe(false);
  });
  it('keeps one page version in play', () => {
    setPageVersionArchived(root, { page: 'home', version: 'v1', archived: true });
    setPageVersionArchived(root, { page: 'home', version: 'v2', archived: true });
    expect(() => setPageVersionArchived(root, { page: 'home', version: 'v3', archived: true })).toThrow('last one');
  });
  it('refuses what does not exist and path-like names', () => {
    expect(() => setComponentArchived(root, { component: 'nope', archived: true })).toThrow('no component');
    expect(() => setComponentArchived(root, { component: '../x', archived: true })).toThrow('not valid');
    expect(() => setPageArchived(root, { page: 'nope', archived: true })).toThrow('no page');
    expect(() => setPageVersionArchived(root, { page: 'home', version: 'v9', archived: true })).toThrow('no saved version');
    expect(existsSync(pfile()) || existsSync(cfile())).toBe(false);
  });
  it('the endpoint takes each kind, refuses another site and a request that says nothing', () => {
    expect(handleArchiveRequest(root, { method: 'GET' }).body).toEqual({ available: true });
    const post = (b: object, origin?: string) => handleArchiveRequest(root, { method: 'POST', host: 'a:1', ...(origin ? { origin } : {}), body: JSON.stringify(b) });
    expect(post({ kind: 'component', component: 'card', archived: true })).toEqual({ status: 200, body: { archived: true } });
    expect(post({ kind: 'page', page: 'home', archived: true })).toEqual({ status: 200, body: { archived: true } });
    expect(post({ kind: 'page-version', page: 'home', version: 'v1', archived: true })).toEqual({ status: 200, body: { archived: ['v1'] } });
    expect(post({ kind: 'page', page: 'home', archived: true }, 'http://evil.example').status).toBe(403);
    expect(post({ kind: 'page', page: 'home' }).status).toBe(400);
    expect(post({ kind: 'other', archived: true }).status).toBe(400);
    expect(handleArchiveRequest(root, { method: 'DELETE' }).status).toBe(405);
  });
});
