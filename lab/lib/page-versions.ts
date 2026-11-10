import type { ComponentModule, MotionMap, PageConfig } from './types.js';
import { PAGE_STAGGER_DEFAULT, PAGE_STAGGER_NONE } from './stagger.js';

// A page version is a named combination for one page: which version of each component plays in
// each slot (`motionMap`, keyed by the page's component ids) and how the page staggers. It points at
// component versions and copies nothing, so improving a component version improves every page
// version that uses it. Files live in pages/<page>/versions/v1.json, v2.json, … (next free integer).

export interface PageVersion {
  /** `v1`, `v2`, … the next free integer, like component versions. */
  id: string;
  label: string;
  /** Page slot (component id on the page) → version id of that slot's component. */
  motionMap: MotionMap;
  /** `none` or a delay token path (`delay.120`). Absent = the default stagger setting. */
  stagger?: string;
  /** The page version this one was copied from. */
  forkedFrom?: string;
}

const VERSION_ID = /^v(\d+)$/;
const STAGGER_TOKEN = /^delay\.[a-z0-9-]+$/;

export function validatePageVersion(data: unknown): PageVersion {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('A page version must be an object');
  const p = data as Record<string, unknown>;
  const id = p['id'];
  if (typeof id !== 'string' || !VERSION_ID.test(id)) throw new Error('A page version needs an id like "v1", "v2", …');
  if (typeof p['label'] !== 'string' || !p['label'].trim()) throw new Error(`Page version "${id}" needs a label`);
  const mm = p['motionMap'];
  if (typeof mm !== 'object' || mm === null || Array.isArray(mm)) throw new Error(`Page version "${id}" needs a motionMap`);
  const motionMap: MotionMap = {};
  for (const [slot, versionId] of Object.entries(mm as Record<string, unknown>)) {
    if (typeof versionId !== 'string') throw new Error(`Page version "${id}": the version for "${slot}" must be a string`);
    motionMap[slot] = versionId;
  }
  const out: PageVersion = { id, label: p['label'].trim(), motionMap };
  const stagger = p['stagger'];
  if (stagger !== undefined) {
    if (stagger !== PAGE_STAGGER_NONE && !(typeof stagger === 'string' && STAGGER_TOKEN.test(stagger))) {
      throw new Error(`Page version "${id}": stagger must be "none" or a delay token such as "delay.120"`);
    }
    out.stagger = stagger;
  }
  const forkedFrom = p['forkedFrom'];
  if (forkedFrom !== undefined) {
    if (typeof forkedFrom !== 'string' || !VERSION_ID.test(forkedFrom)) throw new Error(`Page version "${id}": forkedFrom must be a page version id`);
    out.forkedFrom = forkedFrom;
  }
  return out;
}

export function serializePageVersion(v: PageVersion): string {
  const ordered: PageVersion = { id: v.id, label: v.label, motionMap: v.motionMap };
  if (v.stagger !== undefined) ordered.stagger = v.stagger;
  if (v.forkedFrom !== undefined) ordered.forkedFrom = v.forkedFrom;
  return JSON.stringify(ordered, null, 2) + '\n';
}

const num = (id: string): number => Number(VERSION_ID.exec(id)?.[1] ?? Number.MAX_SAFE_INTEGER);

export function sortPageVersions<T extends { id: string }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => num(a.id) - num(b.id));
}

// The next free integer: v1 when there are none.
export function nextPageVersionId(versions: { id: string }[]): string {
  const max = versions.reduce((m, v) => (VERSION_ID.test(v.id) ? Math.max(m, num(v.id)) : m), 0);
  return `v${max + 1}`;
}

// Every slot on its component's default version.
// What one slot of a page version says. Three forms, all a string in the motion map:
//   "v2"                  that version of the slot's own component (the usual)
//   "none"                the slot is left out of this page version (nothing is shown there)
//   "card-routing@v2"     another component, in the slot's place: the slot keeps its position on the page and shows that component's version
export const SLOT_NONE = 'none';

export type SlotChoice =
  | { kind: 'none' }
  | { kind: 'version'; component: string; version: string; swapped: boolean };

/** The string for a slot that shows another component's version. */
export function swapChoice(component: string, version: string): string {
  return `${component}@${version}`;
}

/** What a slot's entry in a motion map means (not checked against the components: see resolveMotionMap). */
export function parseSlotChoice(value: string | undefined, slotComponent: string): SlotChoice | { kind: 'default' } {
  if (value === undefined) return { kind: 'default' };
  if (value === SLOT_NONE) return { kind: 'none' };
  const at = value.indexOf('@');
  if (at > 0) return { kind: 'version', component: value.slice(0, at), version: value.slice(at + 1), swapped: value.slice(0, at) !== slotComponent };
  return { kind: 'version', component: slotComponent, version: value, swapped: false };
}

export function defaultMotionMap(page: PageConfig, modules: Record<string, ComponentModule>): MotionMap {
  const map: MotionMap = {};
  for (const slot of page.components) {
    const module = modules[slot.component];
    if (module) map[slot.id] = module.defaultVersion;
  }
  return map;
}

// A motion map made whole for this page: a slot with no valid version (missing, or one a
// component no longer has) falls back to the component's default, and slots not on the page drop out.
export function resolveMotionMap(
  map: MotionMap,
  page: PageConfig,
  modules: Record<string, ComponentModule>,
): MotionMap {
  const out: MotionMap = {};
  for (const slot of page.components) {
    const module = modules[slot.component];
    if (!module) continue;
    const choice = parseSlotChoice(map[slot.id], slot.component);
    if (choice.kind === 'none') { out[slot.id] = SLOT_NONE; continue; }
    if (choice.kind === 'version' && choice.swapped) {
      // another component in this slot, when it and its version exist
      if (modules[choice.component]?.versions.some(v => v.id === choice.version)) { out[slot.id] = swapChoice(choice.component, choice.version); continue; }
      out[slot.id] = module.defaultVersion;
      continue;
    }
    const wanted = choice.kind === 'version' ? choice.version : undefined;
    out[slot.id] = wanted !== undefined && module.versions.some(v => v.id === wanted) ? wanted : module.defaultVersion;
  }
  return out;
}

// Problems with one page version against its page and the components' versions (empty = fine).
export function checkPageVersion(
  version: PageVersion,
  page: PageConfig,
  modules: Record<string, ComponentModule>,
): string[] {
  const problems: string[] = [];
  const slots = new Map(page.components.map(c => [c.id, c.component]));
  for (const [slot, versionId] of Object.entries(version.motionMap)) {
    const component = slots.get(slot);
    if (component === undefined) {
      problems.push(`${version.id}: "${slot}" is not on page "${page.id}"`);
      continue;
    }
    const choice = parseSlotChoice(versionId, component);
    if (choice.kind === 'none') continue;
    const shown = choice.kind === 'version' ? choice.component : component;
    const shownVersion = choice.kind === 'version' ? choice.version : versionId;
    const module = modules[shown];
    if (!module) problems.push(`${version.id}: component "${shown}" (for "${slot}") does not exist`);
    else if (!module.versions.some(v => v.id === shownVersion)) {
      problems.push(`${version.id}: "${shown}" has no version "${shownVersion}" (for "${slot}")`);
    }
  }
  return problems;
}

// All of a page's versions: unique ids, a valid forkedFrom, and each one checked.
export function checkPageVersions(
  versions: PageVersion[],
  page: PageConfig,
  modules: Record<string, ComponentModule>,
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const v of versions) {
    if (ids.has(v.id)) problems.push(`${v.id}: duplicate page version id`);
    ids.add(v.id);
  }
  for (const v of versions) {
    if (v.forkedFrom !== undefined && !ids.has(v.forkedFrom)) problems.push(`${v.id}: forkedFrom "${v.forkedFrom}" does not exist`);
    problems.push(...checkPageVersion(v, page, modules));
  }
  return problems;
}

// What a page with no saved versions plays: every component's default.
export function implicitPageVersion(page: PageConfig, modules: Record<string, ComponentModule>): PageVersion {
  return { id: 'v1', label: 'Default', motionMap: defaultMotionMap(page, modules) };
}

// A page's versions in order, or the implicit default when none were saved.
export function pageVersionsOf(
  saved: PageVersion[],
  page: PageConfig,
  modules: Record<string, ComponentModule>,
): PageVersion[] {
  return saved.length > 0 ? sortPageVersions(saved) : [implicitPageVersion(page, modules)];
}

// A version's stagger as the page view's select value: `default`, `none`, or the token label (`120`).
export function staggerToChoice(stagger: string | undefined): string {
  if (stagger === undefined) return PAGE_STAGGER_DEFAULT;
  if (stagger === PAGE_STAGGER_NONE) return PAGE_STAGGER_NONE;
  return stagger.replace(/^delay\./, '');
}

// The reverse: what to store for a select value (`default` stores nothing).
export function choiceToStagger(choice: string): string | undefined {
  if (choice === PAGE_STAGGER_DEFAULT) return undefined;
  if (choice === PAGE_STAGGER_NONE) return PAGE_STAGGER_NONE;
  return `delay.${choice}`;
}
