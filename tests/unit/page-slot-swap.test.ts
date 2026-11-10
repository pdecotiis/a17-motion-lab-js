import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPageVersion, parseSlotChoice, resolveMotionMap, swapChoice } from '../../lab/lib/page-versions.js';
import { savePageVersion } from '../../scripts/page-version-save.js';
import type { ComponentModule, MotionVersion, PageConfig } from '../../lab/lib/types.js';

// A page version can leave a slot out ("none") or put another component's version in its place ("component@v2"); generic components, no project content.
const v = (id: string): MotionVersion => ({ id, label: id, lineage: 'test' } as MotionVersion);
const modules: Record<string, ComponentModule> = {
  hero: { versions: [v('v1'), v('v2')], defaultVersion: 'v1' },
  tabs: { versions: [v('v1'), v('v3')], defaultVersion: 'v1' },
  card: { versions: [v('v1')], defaultVersion: 'v1' },
};
const page: PageConfig = { id: 'home', title: 'Home', components: [{ id: 'hero', component: 'hero' }, { id: 'tabs-slot', component: 'tabs' }, { id: 'card-1', component: 'card' }] };

describe('parseSlotChoice', () => {
  it('reads a version, none, and another component\'s version', () => {
    expect(parseSlotChoice('v2', 'hero')).toEqual({ kind: 'version', component: 'hero', version: 'v2', swapped: false });
    expect(parseSlotChoice('none', 'hero')).toEqual({ kind: 'none' });
    expect(parseSlotChoice(swapChoice('card', 'v1'), 'hero')).toEqual({ kind: 'version', component: 'card', version: 'v1', swapped: true });
    expect(parseSlotChoice(swapChoice('hero', 'v2'), 'hero')).toMatchObject({ swapped: false });
    expect(parseSlotChoice(undefined, 'hero')).toEqual({ kind: 'default' });
  });
});

describe('resolveMotionMap', () => {
  it('keeps a slot left out, and another component put in its place', () => {
    expect(resolveMotionMap({ hero: 'none', 'tabs-slot': 'card@v1' }, page, modules)).toEqual({ hero: 'none', 'tabs-slot': 'card@v1', 'card-1': 'v1' });
  });
  it('falls back to the slot\'s default when the replacement does not exist', () => {
    expect(resolveMotionMap({ 'tabs-slot': 'ghost@v1' }, page, modules)['tabs-slot']).toBe('v1');
    expect(resolveMotionMap({ 'tabs-slot': 'card@v9' }, page, modules)['tabs-slot']).toBe('v1');
  });
});

describe('checkPageVersion', () => {
  const version = (motionMap: Record<string, string>) => ({ id: 'v1', label: 'x', motionMap });
  it('accepts none and a real replacement', () => {
    expect(checkPageVersion(version({ hero: 'none', 'tabs-slot': 'hero@v2' }), page, modules)).toEqual([]);
  });
  it('says what is wrong with a replacement that does not exist', () => {
    expect(checkPageVersion(version({ 'tabs-slot': 'ghost@v1' }), page, modules)[0]).toMatch(/component "ghost"/);
    expect(checkPageVersion(version({ 'tabs-slot': 'hero@v9' }), page, modules)[0]).toMatch(/no version "v9"/);
  });
});

describe('savePageVersion with a slot left out or replaced', () => {
  it('writes them and refuses a replacement that does not exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'slot-swap-'));
    try {
      const w = (rel: string, c: string): void => { mkdirSync(join(root, rel, '..'), { recursive: true }); writeFileSync(join(root, rel), c); };
      w('pages/home/page.json', JSON.stringify(page));
      for (const [c, versions] of [['hero', ['v1', 'v2']], ['tabs', ['v1', 'v3']], ['card', ['v1']]] as const) for (const x of versions) w(`components/${c}/versions/${x}.ts`, '');
      const saved = savePageVersion(root, { page: 'home', label: 'Swapped', motionMap: { hero: 'none', 'tabs-slot': 'card@v1' } });
      expect(saved.motionMap).toEqual({ hero: 'none', 'tabs-slot': 'card@v1' });
      expect(existsSync(join(root, 'pages/home/versions/v1.json'))).toBe(true);
      expect(() => savePageVersion(root, { page: 'home', label: 'Bad', motionMap: { 'tabs-slot': 'card@v7' } })).toThrow(/no version "v7"/);
      expect(() => savePageVersion(root, { page: 'home', label: 'Bad', motionMap: { 'tabs-slot': '../x@v1' } })).toThrow();
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
