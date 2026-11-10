import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archivedIdsOf, withArchived, serializeArchived, applyArchived, activeVersions, isArchived } from '../../lab/lib/archived.js';
import { setVersionArchived, archivedVersions, versionIdsOf } from '../../scripts/version-archive-save.js';
import { handleVersionArchiveRequest } from '../../scripts/version-archive-plugin.js';
import { buildLibraryEntries } from '../../lab/lib/library.js';
import type { MotionVersion, ComponentModule } from '../../lab/lib/types.js';

describe('the archived list', () => {
  it('reads version ids from archived.json, ignoring anything else, in order', () => {
    expect(archivedIdsOf({ versions: ['v10', 'v2', 'v2', 'nope', 3, '../v1'] })).toEqual(['v2', 'v10']);
    expect(archivedIdsOf(null)).toEqual([]);
    expect(archivedIdsOf({ versions: 'v1' })).toEqual([]);
  });
  it('archives and unarchives one id, keeping the list in order', () => {
    expect(withArchived(['v3'], 'v1', true)).toEqual(['v1', 'v3']);
    expect(withArchived(['v1', 'v3'], 'v1', false)).toEqual(['v3']);
    expect(withArchived(['v1'], 'v1', true)).toEqual(['v1']);
    expect(serializeArchived(['v1', 'v3'])).toBe('{\n  "versions": [\n    "v1",\n    "v3"\n  ]\n}\n');
  });
  it('marks the versions it names and clears the mark on the rest', () => {
    const versions = [{ id: 'v1' }, { id: 'v2', archived: true }, { id: 'v3' }] as MotionVersion[];
    applyArchived(versions, ['v3']);
    expect(versions.map(isArchived)).toEqual([false, false, true]);
    expect(activeVersions(versions).map(v => v.id)).toEqual(['v1', 'v2']);
  });
  it('a library card does not preview an archived version', () => {
    const mk = (id: string, archived?: boolean): MotionVersion => ({ id, label: id, lineage: 'x', ...(archived ? { archived: true } : {}) } as MotionVersion);
    const mod = (versions: MotionVersion[], defaultVersion: string): ComponentModule => ({ versions, defaultVersion });
    const entries = buildLibraryEntries({ a: mod([mk('v1', true), mk('v2')], 'v1'), b: mod([mk('v1'), mk('v2')], 'v2') });
    expect(entries.find(e => e.name === 'a')!.previewVersion.id).toBe('v2');   // the default is archived: the first one in play
    expect(entries.find(e => e.name === 'b')!.previewVersion.id).toBe('v2');
    expect(entries.find(e => e.name === 'a')!.totalVersions).toBe(2);
  });
});

describe('saving the archived list', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'archive-'));
    for (const v of ['v1', 'v2', 'v3']) { mkdirSync(join(root, 'components/card/versions'), { recursive: true }); writeFileSync(join(root, `components/card/versions/${v}.ts`), ''); }
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));
  const file = (): string => join(root, 'components/card/archived.json');

  it('writes archived.json beside the component and never touches a version file', () => {
    const before = readFileSync(join(root, 'components/card/versions/v2.ts'), 'utf8');
    expect(setVersionArchived(root, { component: 'card', version: 'v2', archived: true })).toEqual(['v2']);
    expect(JSON.parse(readFileSync(file(), 'utf8'))).toEqual({ versions: ['v2'] });
    expect(readFileSync(join(root, 'components/card/versions/v2.ts'), 'utf8')).toBe(before);
    expect(versionIdsOf(root, 'card').sort()).toEqual(['v1', 'v2', 'v3']);
  });
  it('unarchives, and removes the file once nothing is archived', () => {
    setVersionArchived(root, { component: 'card', version: 'v1', archived: true });
    setVersionArchived(root, { component: 'card', version: 'v3', archived: true });
    expect(archivedVersions(root, 'card')).toEqual(['v1', 'v3']);
    setVersionArchived(root, { component: 'card', version: 'v1', archived: false });
    expect(archivedVersions(root, 'card')).toEqual(['v3']);
    setVersionArchived(root, { component: 'card', version: 'v3', archived: false });
    expect(existsSync(file())).toBe(false);
  });
  it('keeps at least one version in play', () => {
    setVersionArchived(root, { component: 'card', version: 'v1', archived: true });
    setVersionArchived(root, { component: 'card', version: 'v2', archived: true });
    expect(() => setVersionArchived(root, { component: 'card', version: 'v3', archived: true })).toThrow('last one');
    expect(archivedVersions(root, 'card')).toEqual(['v1', 'v2']);
  });
  it('refuses a missing component or version and a path-like name', () => {
    expect(() => setVersionArchived(root, { component: 'nope', version: 'v1', archived: true })).toThrow('no component');
    expect(() => setVersionArchived(root, { component: 'card', version: 'v9', archived: true })).toThrow('no version');
    expect(() => setVersionArchived(root, { component: '../x', version: 'v1', archived: true })).toThrow('not valid');
    expect(existsSync(file())).toBe(false);
  });
  it('the endpoint answers GET, takes a POST, and refuses another site', () => {
    expect(handleVersionArchiveRequest(root, { method: 'GET' }).body).toEqual({ available: true });
    const body = JSON.stringify({ component: 'card', version: 'v2', archived: true });
    expect(handleVersionArchiveRequest(root, { method: 'POST', host: 'a:1', origin: 'http://a:1', body })).toEqual({ status: 200, body: { archived: ['v2'] } });
    expect(handleVersionArchiveRequest(root, { method: 'POST', host: 'a:1', origin: 'http://evil.example', body }).status).toBe(403);
    expect(handleVersionArchiveRequest(root, { method: 'POST', body: JSON.stringify({ component: 'card', version: 'v2' }) }).status).toBe(400);
    expect(handleVersionArchiveRequest(root, { method: 'DELETE' }).status).toBe(405);
  });
});
