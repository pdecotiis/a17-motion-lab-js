import { describe, it, expect } from 'vitest';
import { buildLibraryEntries, libraryFilterFromParams } from '../../lab/lib/library.js';
import type { ComponentModule, MotionVersion } from '../../lab/lib/types.js';

const version = (over: Partial<MotionVersion> & { id: string }): MotionVersion => ({
  label: over.id,
  model: { model: 'tween', duration: 'motion.timings.base', easing: 'motion.easings.ease-out' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  lineage: 'imported from test',
  ...over,
});

const modules: Record<string, ComponentModule> = {
  'hero-banner': {
    defaultVersion: 'v1',
    versions: [version({ id: 'v1' }), version({ id: 'v2', status: 'review', forkedFrom: 'v1' })],
  },
  card: {
    defaultVersion: 'v1',
    versions: [version({ id: 'v1', status: 'archived' }), version({ id: 'v2', status: 'approved', forkedFrom: 'v1' })],
  },
  'old-thing': {
    defaultVersion: 'v1',
    versions: [version({ id: 'v1', status: 'archived' })],
  },
};

describe('buildLibraryEntries', () => {
  it('lists components alphabetically and hides ones with only archived versions', () => {
    expect(buildLibraryEntries(modules).map(e => e.name)).toEqual(['card', 'hero-banner']);
  });

  it('shows archived-only components with showArchived', () => {
    const names = buildLibraryEntries(modules, { showArchived: true }).map(e => e.name);
    expect(names).toEqual(['card', 'hero-banner', 'old-thing']);
  });

  it('previews the default version when it is visible', () => {
    const entry = buildLibraryEntries(modules).find(e => e.name === 'hero-banner')!;
    expect(entry.previewVersion.id).toBe('v1');
  });

  it('previews the first visible version when the default is hidden', () => {
    const entry = buildLibraryEntries(modules).find(e => e.name === 'card')!;
    expect(entry.previewVersion.id).toBe('v2');
    expect(entry.visibleVersions.map(v => v.id)).toEqual(['v2']);
    expect(entry.totalVersions).toBe(2);
  });

  it('filters by status', () => {
    expect(buildLibraryEntries(modules, { status: 'review' }).map(e => e.name)).toEqual(['hero-banner']);
    expect(buildLibraryEntries(modules, { status: 'archived' }).map(e => e.name)).toEqual(['card', 'old-thing']);
  });

  it('filters by name, treating hyphens as spaces and ignoring case', () => {
    expect(buildLibraryEntries(modules, { query: 'HERO ban' }).map(e => e.name)).toEqual(['hero-banner']);
    expect(buildLibraryEntries(modules, { query: 'nope' })).toEqual([]);
  });
});

describe('libraryFilterFromParams', () => {
  it('reads status, archived and q from the URL', () => {
    const f = libraryFilterFromParams(new URLSearchParams('status=review&archived=1&q=hero'));
    expect(f).toEqual({ status: 'review', showArchived: true, query: 'hero' });
  });

  it('defaults to all statuses, archived hidden, no query', () => {
    expect(libraryFilterFromParams(new URLSearchParams(''))).toEqual({ status: 'all', showArchived: false, query: '' });
  });
});
