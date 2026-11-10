import { describe, it, expect } from 'vitest';
import { LAYOUTS, COLUMNS, CELLS, STATE_ORDER, boxOf, isColour, overlapsBetween, sizeOf } from '../../components/card-routing-shuffle/layouts';
import { versions } from '../../components/card-routing-shuffle/motion';
import { validateVersionMeta } from '../../lab/lib/version-meta';

describe('card-routing-shuffle', () => {
  it('has valid version meta', () => { expect(() => validateVersionMeta(versions)).not.toThrow(); });
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    it(`${name}: three rows to a column, a card takes 0, 1 or 2 rows and its picture the rest`, () => {
      for (const id of Object.keys(layout)) expect(CELLS, id).toContain(id);
      for (const col of COLUMNS) {
        expect(col.reduce((n, id) => n + (layout[id] ?? 0), 0), col.join()).toBe(3);
        const shown = col.map(id => boxOf(layout, id)).filter(b => b.h > 0), last = shown[shown.length - 1]!;
        expect(last.y + last.h).toBe(712);
      }
      for (const id of CELLS.filter(isColour)) expect(layout[id] ?? 0, id).toBeLessThanOrEqual(2);
    });
  }
  it('cells push each other: from every arrangement to the next (and round to the first), no two cells can overlap on the way', () => {
    STATE_ORDER.forEach((name, k) => {
      const next = STATE_ORDER[(k + 1) % STATE_ORDER.length]!;
      expect(overlapsBetween(LAYOUTS[name]!, LAYOUTS[next]!), `${name} -> ${next}`).toEqual([]);
    });
  });
  it('a cell never changes width, so it only ever changes in height', () => {
    for (const layout of Object.values(LAYOUTS)) for (const id of CELLS) expect(boxOf(layout, id).w).toBe(352);
  });
  it('the first arrangement is the page: a card on top, at the bottom, on top', () => {
    const d = LAYOUTS.default!;
    expect([d.y0, d.p0]).toEqual([1, 2]);
    expect([d.p1, d.i1]).toEqual([2, 1]);
    expect([d.g2, d.v2]).toEqual([1, 2]);
  });
  it('writes what a cell sets: its height and the gap under it', () => {
    expect(sizeOf(LAYOUTS.default!, 'p0')).toEqual({ height: '472px', marginBottom: '8px' });
    expect(sizeOf(LAYOUTS['layout-6']!, 'y0')).toEqual({ height: '0px', marginBottom: '0px' });
  });
});
