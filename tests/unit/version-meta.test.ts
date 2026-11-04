import { describe, it, expect } from 'vitest';
import {
  getComponentStatus, isComponentStatus, COMPONENT_STATUSES, validateVersionMeta, forkVersion, componentPasses, describeLineage, filterFromParams,
} from '../../lab/lib/version-meta.js';
import { validateMotionVersion } from '../../lab/lib/motion-models.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const base = (over: Partial<MotionVersion> & { id: string }): MotionVersion => ({
  label: over.id,
  model: { model: 'tween', duration: 'duration.base', easing: 'easing.ease-out' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  ...over,
});

const v1 = base({ id: 'v1', label: 'Fade Up', lineage: 'imported from https://figma.com/x' });
const v2 = base({ id: 'v2', label: 'Scale In', forkedFrom: 'v1' });
const v3 = base({ id: 'v3', label: 'Old', forkedFrom: 'v1' });
const versions = [v1, v2, v3];

describe('status and lineage validation', () => {
  it('accepts valid lineage, and a valid or absent component status', () => {
    expect(() => validateVersionMeta(versions)).not.toThrow();
    for (const s of COMPONENT_STATUSES) expect(() => validateVersionMeta(versions, s)).not.toThrow();
    versions.forEach(v => expect(() => validateMotionVersion(v)).not.toThrow());
  });

  it('rejects an unknown component status', () => {
    expect(() => validateVersionMeta(versions, 'done')).toThrow(/unknown status "done"/);
    expect(isComponentStatus('review')).toBe(true);
    expect(isComponentStatus('done')).toBe(false);
  });

  it('rejects a status on a version: approval is the component\'s', () => {
    const bad = { ...base({ id: 'v1', lineage: 'imported from x' }), status: 'approved' } as unknown as MotionVersion;
    expect(() => validateMotionVersion(bad)).toThrow(/disallowed property: "status"/);
  });

  it('rejects a version forked from a parent that does not exist', () => {
    const orphan = base({ id: 'v2', forkedFrom: 'v9' });
    expect(() => validateVersionMeta([v1, orphan])).toThrow(/"v9", which does not exist/);
  });

  it('rejects a version forked from itself', () => {
    expect(() => validateVersionMeta([base({ id: 'v1', forkedFrom: 'v1' })])).toThrow(/itself/);
  });

  it('rejects a version with no lineage', () => {
    expect(() => validateVersionMeta([v1, base({ id: 'v2' })])).toThrow(/needs lineage/);
  });
});

describe('new versions', () => {
  it('record the parent as lineage', () => {
    const fork = forkVersion(v2, 'v4', 'Faster Scale');
    expect(fork.id).toBe('v4');
    expect(fork.label).toBe('Faster Scale');
    expect((fork as unknown as { status?: string }).status).toBeUndefined();
    expect(fork.forkedFrom).toBe('v2');
    expect(fork.lineage).toBeUndefined();
    expect(() => validateVersionMeta([...versions, fork])).not.toThrow();
    expect(() => validateMotionVersion(fork)).not.toThrow();
  });

  it('does not inherit the parent import lineage, review notes or share its objects', () => {
    const withNotes = { ...v1, reviewNotes: 'ok' };
    const fork = forkVersion(withNotes, 'v2', 'Copy');
    expect(fork.lineage).toBeUndefined();
    expect(fork.reviewNotes).toBeUndefined();
    expect(fork.keyframes).not.toBe(v1.keyframes);
  });

});

describe('component status', () => {
  it('a component with no stored status counts as in-progress', () => {
    expect(getComponentStatus({})).toBe('in-progress');
    expect(getComponentStatus({ status: 'approved' })).toBe('approved');
  });

  it('componentPasses hides archived components by default', () => {
    expect(componentPasses({ status: 'review' })).toBe(true);
    expect(componentPasses({})).toBe(true);
    expect(componentPasses({ status: 'archived' })).toBe(false);
  });

  it('shows archived components with the toggle', () => {
    expect(componentPasses({ status: 'archived' }, { showArchived: true })).toBe(true);
  });

  it('filters by a single status', () => {
    expect(componentPasses({ status: 'review' }, { status: 'review' })).toBe(true);
    expect(componentPasses({ status: 'approved' }, { status: 'review' })).toBe(false);
    expect(componentPasses({ status: 'archived' }, { status: 'archived' })).toBe(true);
    expect(componentPasses({}, { status: 'in-progress' })).toBe(true);
  });
});

describe('describeLineage and URL params', () => {
  it('describes forks and imports', () => {
    expect(describeLineage(v2, versions)).toBe('Forked from v1: Fade Up');
    expect(describeLineage(v1, versions)).toBe('Imported from https://figma.com/x');
  });

  it('reads status and archived params, ignoring unknown statuses', () => {
    expect(filterFromParams(new URLSearchParams('status=review&archived=1'))).toEqual({ status: 'review', showArchived: true });
    expect(filterFromParams(new URLSearchParams('status=bogus'))).toEqual({ status: 'all', showArchived: false });
  });
});
