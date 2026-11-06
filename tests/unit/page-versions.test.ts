import { describe, it, expect } from 'vitest';
import {
  checkPageVersion, checkPageVersions, choiceToStagger, defaultMotionMap, implicitPageVersion, nextPageVersionId,
  pageVersionsOf, resolveMotionMap, serializePageVersion, sortPageVersions, staggerToChoice, validatePageVersion,
} from '../../lab/lib/page-versions.js';
import type { ComponentModule, MotionVersion, PageConfig } from '../../lab/lib/types.js';

const version = (id: string): MotionVersion => ({
  id,
  label: id,
  model: { model: 'tween', duration: 'duration.200', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  lineage: 'imported from test',
});

const modules: Record<string, ComponentModule> = {
  hero: { defaultVersion: 'v2', versions: [version('v1'), version('v2'), version('v3')] },
  card: { defaultVersion: 'v1', versions: [version('v1'), version('v2')] },
};

const page: PageConfig = {
  id: 'home',
  title: 'Home',
  components: [
    { id: 'hero', component: 'hero' },
    { id: 'card-1', component: 'card' },
    { id: 'card-2', component: 'card' },
  ],
};

describe('validatePageVersion', () => {
  it('accepts a page version and keeps only the known fields', () => {
    const v = validatePageVersion({ id: 'v2', label: ' Layered ', motionMap: { hero: 'v3' }, stagger: 'delay.120', forkedFrom: 'v1', extra: 1 });
    expect(v).toEqual({ id: 'v2', label: 'Layered', motionMap: { hero: 'v3' }, stagger: 'delay.120', forkedFrom: 'v1' });
  });

  it('needs an id like v1, a label and a motionMap of strings', () => {
    expect(() => validatePageVersion('x')).toThrow('object');
    expect(() => validatePageVersion({ id: 'layered', label: 'L', motionMap: {} })).toThrow('id');
    expect(() => validatePageVersion({ id: 'v1', label: ' ', motionMap: {} })).toThrow('label');
    expect(() => validatePageVersion({ id: 'v1', label: 'L' })).toThrow('motionMap');
    expect(() => validatePageVersion({ id: 'v1', label: 'L', motionMap: { hero: 3 } })).toThrow('string');
  });

  it('allows stagger only as none or a delay token, and forkedFrom only as a version id', () => {
    expect(validatePageVersion({ id: 'v1', label: 'L', motionMap: {}, stagger: 'none' }).stagger).toBe('none');
    expect(() => validatePageVersion({ id: 'v1', label: 'L', motionMap: {}, stagger: '120' })).toThrow('stagger');
    expect(() => validatePageVersion({ id: 'v1', label: 'L', motionMap: {}, stagger: 'delay.' })).toThrow('stagger');
    expect(() => validatePageVersion({ id: 'v2', label: 'L', motionMap: {}, forkedFrom: 'a' })).toThrow('forkedFrom');
  });
});

describe('ids and order', () => {
  it('sorts by number, not text, and the next id is the next free integer', () => {
    const vs = [{ id: 'v10' }, { id: 'v2' }, { id: 'v1' }];
    expect(sortPageVersions(vs).map(v => v.id)).toEqual(['v1', 'v2', 'v10']);
    expect(nextPageVersionId(vs)).toBe('v11');
    expect(nextPageVersionId([])).toBe('v1');
  });
});

describe('motion maps', () => {
  it('defaults every slot to its component\'s default version', () => {
    expect(defaultMotionMap(page, modules)).toEqual({ hero: 'v2', 'card-1': 'v1', 'card-2': 'v1' });
  });

  it('fills a missing slot, replaces a version the component lacks, and drops unknown slots', () => {
    expect(resolveMotionMap({ hero: 'v3', 'card-2': 'v9', gone: 'v1' }, page, modules))
      .toEqual({ hero: 'v3', 'card-1': 'v1', 'card-2': 'v1' });
  });
});

describe('checking versions against the page', () => {
  it('passes a version whose slots and versions exist', () => {
    expect(checkPageVersion({ id: 'v1', label: 'A', motionMap: { hero: 'v3', 'card-1': 'v2' } }, page, modules)).toEqual([]);
  });

  it('reports a slot that is not on the page and a version the component does not have', () => {
    const problems = checkPageVersion({ id: 'v1', label: 'A', motionMap: { nope: 'v1', 'card-1': 'v9' } }, page, modules);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('"nope" is not on page "home"');
    expect(problems[1]).toContain('"card" has no version "v9"');
  });

  it('reports duplicate ids and a forkedFrom that does not exist', () => {
    const problems = checkPageVersions([
      { id: 'v1', label: 'A', motionMap: {} },
      { id: 'v1', label: 'B', motionMap: {} },
      { id: 'v2', label: 'C', motionMap: {}, forkedFrom: 'v7' },
    ], page, modules);
    expect(problems.join('\n')).toContain('duplicate page version id');
    expect(problems.join('\n')).toContain('forkedFrom "v7" does not exist');
  });
});

describe('a page with no saved versions', () => {
  it('plays the implicit default', () => {
    const [only] = pageVersionsOf([], page, modules);
    expect(only).toEqual(implicitPageVersion(page, modules));
    expect(only!.id).toBe('v1');
    expect(only!.motionMap).toEqual(defaultMotionMap(page, modules));
  });

  it('lists saved versions in order', () => {
    const saved = [{ id: 'v2', label: 'B', motionMap: {} }, { id: 'v1', label: 'A', motionMap: {} }];
    expect(pageVersionsOf(saved, page, modules).map(v => v.id)).toEqual(['v1', 'v2']);
  });
});

describe('stagger as a select value', () => {
  it('maps a stored stagger to the page view\'s choice and back', () => {
    expect(staggerToChoice(undefined)).toBe('default');
    expect(staggerToChoice('none')).toBe('none');
    expect(staggerToChoice('delay.120')).toBe('120');
    expect(choiceToStagger('default')).toBeUndefined();
    expect(choiceToStagger('none')).toBe('none');
    expect(choiceToStagger('120')).toBe('delay.120');
  });
});

describe('serializePageVersion', () => {
  it('writes the fields in a stable order and omits what is absent', () => {
    expect(serializePageVersion({ forkedFrom: 'v1', motionMap: { hero: 'v3' }, label: 'B', id: 'v2' })).toBe(
      '{\n  "id": "v2",\n  "label": "B",\n  "motionMap": {\n    "hero": "v3"\n  },\n  "forkedFrom": "v1"\n}\n',
    );
  });
});
