import { describe, it, expect } from 'vitest';
import {
  getVersionStatus, validateVersionMeta, forkVersion, filterVersions, describeLineage, filterFromParams,
} from '../../lab/lib/version-meta.js';
import { validateMotionVersion } from '../../lab/lib/motion-models.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const base = (over: Partial<MotionVersion> & { id: string }): MotionVersion => ({
  label: over.id,
  model: { model: 'tween', duration: 'motion.timings.base', easing: 'motion.easings.ease-out' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  ...over,
});

const v1 = base({ id: 'v1', label: 'Fade Up', status: 'approved', lineage: 'imported from https://figma.com/x' });
const v2 = base({ id: 'v2', label: 'Scale In', status: 'review', forkedFrom: 'v1' });
const v3 = base({ id: 'v3', label: 'Old', status: 'archived', forkedFrom: 'v1' });
const versions = [v1, v2, v3];

describe('status and lineage validation', () => {
  it('accepts valid status and lineage', () => {
    expect(() => validateVersionMeta(versions)).not.toThrow();
    versions.forEach(v => expect(() => validateMotionVersion(v)).not.toThrow());
  });

  it('rejects an unknown status', () => {
    const bad = base({ id: 'v1', lineage: 'imported from x', status: 'done' as never });
    expect(() => validateMotionVersion(bad)).toThrow(/unknown status/);
    expect(() => validateVersionMeta([bad])).toThrow(/unknown status/);
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
  it('default to in-progress with the parent recorded as lineage', () => {
    const fork = forkVersion(v2, 'v4', 'Faster Scale');
    expect(fork.id).toBe('v4');
    expect(fork.label).toBe('Faster Scale');
    expect(fork.status).toBe('in-progress');
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

  it('a version with no stored status counts as in-progress', () => {
    expect(getVersionStatus(base({ id: 'v1', lineage: 'x' }))).toBe('in-progress');
  });
});

describe('filterVersions', () => {
  it('hides archived versions by default', () => {
    expect(filterVersions(versions).map(v => v.id)).toEqual(['v1', 'v2']);
  });

  it('shows archived versions with the toggle', () => {
    expect(filterVersions(versions, { showArchived: true }).map(v => v.id)).toEqual(['v1', 'v2', 'v3']);
  });

  it('filters by a single status', () => {
    expect(filterVersions(versions, { status: 'review' }).map(v => v.id)).toEqual(['v2']);
    expect(filterVersions(versions, { status: 'archived' }).map(v => v.id)).toEqual(['v3']);
  });

  it('always keeps the open version, even if archived or filtered out', () => {
    expect(filterVersions(versions, { keepId: 'v3' }).map(v => v.id)).toEqual(['v1', 'v2', 'v3']);
    expect(filterVersions(versions, { status: 'review', keepId: 'v1' }).map(v => v.id)).toEqual(['v1', 'v2']);
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
