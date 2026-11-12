import { describe, it, expect } from 'vitest';
import { BANDS, CELLS, SLIDES, STATES, bandSize, sizeOf, lookOf } from '../../components/card-routing-slideshow/geometry.js';
import { versions } from '../../components/card-routing-slideshow/motion.js';
import { validateVersionMeta } from '../../lab/lib/version-meta.js';

const share = { full: 1, half: 0.5, none: 0 };

describe('card-routing-slideshow', () => {
  it('has versions with lineage', () => expect(() => validateVersionMeta(versions)).not.toThrow());

  it('has six slides, in three pairs', () => expect(SLIDES).toEqual(['trading-1', 'trading-2', 'technology-1', 'technology-2', 'machine-learning-1', 'machine-learning-2']));

  it('fills each column exactly in every slide: the cells that are up add up to the column', () => {
    for (const id of SLIDES) for (const column of ['left', 'right'] as const) {
      const total = CELLS.filter(c => c.column === column).reduce((sum, c) => sum + share[sizeOf(c, id)], 0);
      expect(total, `${column} column in ${id}`).toBe(1);
    }
  });

  it('collapses every cell in the intro, and every cell of the other stories', () => {
    for (const s of STATES) for (const c of CELLS) if (s.group === 'intro' || s.group !== c.group) expect(sizeOf(c, s.id)).toBe('none');
  });

  it('shows the intro bands in the intro and the slides band in the slides, never both', () => {
    for (const s of STATES) {
      expect(bandSize('band-slides', s.id)).toBe(s.group !== 'intro');
      expect(bandSize('band-cards', s.id)).toBe(s.group === 'intro');
    }
    expect(BANDS.filter(b => bandSize(b, 'intro-image'))).toEqual(['band-image', 'band-cards']);
    expect(BANDS.filter(b => bandSize(b, 'cards-only'))).toEqual(['band-cards']);
  });

  it('squeezes the card and fills the room it gives up, with a row of squares: above the trading card, below the others', () => {
    const cell = (id: string) => CELLS.find(c => c.id === id)!;
    expect(sizeOf(cell('t-card'), 'trading-1')).toBe('full');
    expect(sizeOf(cell('t-card'), 'trading-2')).toBe('half');
    expect(sizeOf(cell('t-row'), 'trading-2')).toBe('half');
    expect(sizeOf(cell('e-row'), 'technology-2')).toBe('half');
    expect(sizeOf(cell('m-row'), 'machine-learning-2')).toBe('half');
    expect(CELLS.findIndex(c => c.id === 't-row')).toBeLessThan(CELLS.findIndex(c => c.id === 't-card'));   // above
    expect(CELLS.findIndex(c => c.id === 'm-row')).toBeGreaterThan(CELLS.findIndex(c => c.id === 'm-card'));   // below
  });

  it('knows which look a story has', () => {
    expect(lookOf('trading', 'trading-2')).toBe('B');
    expect(lookOf('trading', 'technology-1')).toBeUndefined();
  });
});
