import { describe, it, expect } from 'vitest';
import { LAYOUTS, COLUMNS, CELLS, STATE_ORDER, boxOf, isColour, overlapsBetween, sizeOf } from '../../components/card-routing-shuffle/layouts';
import { versions } from '../../components/card-routing-shuffle/motion';
import { validateVersionMeta } from '../../lab/lib/version-meta';

describe('card-routing-shuffle', () => {
  it('has valid version meta', () => { expect(() => validateVersionMeta(versions)).not.toThrow(); });
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    it(`${name}: every column adds up to three rows, each colour shows once, a column holds one colour card at most`, () => {
      for (const id of Object.keys(layout)) expect(CELLS, id).toContain(id);
      for (const col of COLUMNS) {
        expect(col.reduce((n, id) => n + (layout[id] ?? 0), 0), col.join()).toBe(3);
        expect(col.filter(id => isColour(id) && (layout[id] ?? 0) > 0).length, col.join()).toBeLessThanOrEqual(1);
      }
      const colours = CELLS.filter(id => isColour(id) && (layout[id] ?? 0) > 0).map(id => id[0]);
      expect(new Set(colours).size).toBe(colours.length);
      // the stacks fill the grid: 712 tall
      for (const col of COLUMNS) { const shown = col.map(id => boxOf(layout, id)).filter(b => b.h > 0); const last = shown[shown.length - 1]!; expect(last.y + last.h).toBe(712); }
    });
  }
  it('cells push each other: from every arrangement to the next (and round to the first), no two cells can overlap on the way', () => {
    STATE_ORDER.forEach((name, k) => {
      const next = STATE_ORDER[(k + 1) % STATE_ORDER.length]!;
      expect(overlapsBetween(LAYOUTS[name]!, LAYOUTS[next]!), `${name} -> ${next}`).toEqual([]);
    });
  });
  it('a cell never changes width, so it never changes in both width and height', () => {
    for (const layout of Object.values(LAYOUTS)) for (const id of CELLS) expect(boxOf(layout, id).w).toBe(352);
  });
  it('writes what a cell sets: its height and the gap under it', () => {
    expect(sizeOf(LAYOUTS['layout-2']!, 'p01')).toEqual({ height: '472px', marginBottom: '8px' });
    expect(sizeOf(LAYOUTS['layout-2']!, 'p02')).toEqual({ height: '0px', marginBottom: '0px' });
  });
});
