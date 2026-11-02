import { describe, it, expect } from 'vitest';
import { buildLibraryEntries, libraryFilterFromParams } from '../../lab/lib/library.js';
import type { ComponentModule, MotionVersion } from '../../lab/lib/types.js';

const version = (over: Partial<MotionVersion> & { id: string }): MotionVersion => ({
  label: over.id,
  model: { model: 'tween', duration: 'duration.base', easing: 'easing.ease-out' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  lineage: 'imported from test',
  ...over,
});

const modules: Record<string, ComponentModule> = {
  'hero-banner': {
    defaultVersion: 'v1',
    status: 'review',
    versions: [version({ id: 'v1' }), version({ id: 'v2', forkedFrom: 'v1' })],
  },
  card: {
    defaultVersion: 'v2',
    status: 'approved',
    versions: [version({ id: 'v1' }), version({ id: 'v2', forkedFrom: 'v1' })],
  },
  'old-thing': {
    defaultVersion: 'v1',
    status: 'archived',
    versions: [version({ id: 'v1' })],
  },
  fresh: {
    defaultVersion: 'v1',
    versions: [version({ id: 'v1' })],
  },
};

describe('buildLibraryEntries', () => {
  it('lists components alphabetically and hides archived ones', () => {
    expect(buildLibraryEntries(modules).map(e => e.name)).toEqual(['card', 'fresh', 'hero-banner']);
  });

  it('shows archived components with showArchived', () => {
    const names = buildLibraryEntries(modules, { showArchived: true }).map(e => e.name);
    expect(names).toEqual(['card', 'fresh', 'hero-banner', 'old-thing']);
  });

  it('carries the component status (absent counts as in-progress)', () => {
    const byName = Object.fromEntries(buildLibraryEntries(modules, { showArchived: true }).map(e => [e.name, e.status]));
    expect(byName).toEqual({ card: 'approved', fresh: 'in-progress', 'hero-banner': 'review', 'old-thing': 'archived' });
  });

  it('previews the component\'s default version and counts all versions', () => {
    const card = buildLibraryEntries(modules).find(e => e.name === 'card')!;
    expect(card.previewVersion.id).toBe('v2');
    expect(card.totalVersions).toBe(2);
    expect(buildLibraryEntries(modules).find(e => e.name === 'hero-banner')!.previewVersion.id).toBe('v1');
  });

  it('filters by the component\'s status', () => {
    expect(buildLibraryEntries(modules, { status: 'review' }).map(e => e.name)).toEqual(['hero-banner']);
    expect(buildLibraryEntries(modules, { status: 'archived' }).map(e => e.name)).toEqual(['old-thing']);
    expect(buildLibraryEntries(modules, { status: 'in-progress' }).map(e => e.name)).toEqual(['fresh']);
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
