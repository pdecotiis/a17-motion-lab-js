import { describe, it, expect } from 'vitest';
import { LAYOUTS, COLUMNS, CELLS, STATE_ORDER, boxOf, isColour, overlapsBetween, sizeOf } from '../../components/card-routing-shuffle/layouts';
import { versions } from '../../components/card-routing-shuffle/motion';
import { validateVersionMeta } from '../../lab/lib/version-meta';

describe('card-routing-shuffle', () => {
  it('has valid version meta', () => { expect(() => validateVersionMeta(versions)).not.toThrow(); });
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    it(`${name}: three rows to a column, the widths fill the grid, colour cards at most 2 rows and once, one to a column, no cell two columns wide`, () => {
      for (const id of Object.keys(layout.rows)) expect(CELLS, id).toContain(id);
      expect(layout.widths.reduce((n, w) => n + w, 0)).toBe(1056);
      for (const w of layout.widths) expect(w).toBeLessThan(704);
      for (const col of COLUMNS) {
        expect(col.reduce((n, id) => n + (layout.rows[id] ?? 0), 0), col.join()).toBe(3);
        expect(col.filter(id => isColour(id) && (layout.rows[id] ?? 0) > 0).length, col.join()).toBeLessThanOrEqual(1);
        const shown = col.map(id => boxOf(layout, id)).filter(b => b.h > 0), last = shown[shown.length - 1]!;
        expect(last.y + last.h).toBe(712);
      }
      for (const id of CELLS.filter(isColour)) expect(layout.rows[id] ?? 0, id).toBeLessThanOrEqual(2);
      const colours = CELLS.filter(id => isColour(id) && (layout.rows[id] ?? 0) > 0).map(id => id[0]);
      expect(new Set(colours).size).toBe(colours.length);
    });
  }
  it('cells push each other: from every arrangement to the next (and round to the first), no two cells can overlap on the way', () => {
    STATE_ORDER.forEach((name, k) => {
      const next = STATE_ORDER[(k + 1) % STATE_ORDER.length]!;
      expect(overlapsBetween(LAYOUTS[name]!, LAYOUTS[next]!), `${name} -> ${next}`).toEqual([]);
    });
  });
  it('from one arrangement to the next either the stacks change or the widths change, never both: a cell never gets smaller in width and height at once', () => {
    STATE_ORDER.forEach((name, k) => {
      const a = LAYOUTS[name]!, b = LAYOUTS[STATE_ORDER[(k + 1) % STATE_ORDER.length]!]!;
      const widths = a.widths.join() !== b.widths.join();
      const stacks = CELLS.some(id => (a.rows[id] ?? 0) !== (b.rows[id] ?? 0));
      expect(widths && stacks, name).toBe(false);
      for (const id of CELLS) { const p = boxOf(a, id), q = boxOf(b, id); expect(q.w < p.w && q.h < p.h, `${name} ${id}`).toBe(false); }
    });
  });
  it('the first arrangement is the page: a card on top, at the bottom, on top', () => {
    const d = LAYOUTS.default!;
    expect([d.rows.y0, d.rows.p00]).toEqual([1, 2]);
    expect([d.rows.p10, d.rows.i1]).toEqual([2, 1]);
    expect([d.rows.g2, d.rows.p20]).toEqual([1, 2]);
  });
  it('writes what a cell sets: its height and the gap under it', () => {
    expect(sizeOf(LAYOUTS.default!, 'p00')).toEqual({ height: '472px', marginBottom: '8px' });
    expect(sizeOf(LAYOUTS.default!, 'p01')).toEqual({ height: '0px', marginBottom: '0px' });
  });
});
