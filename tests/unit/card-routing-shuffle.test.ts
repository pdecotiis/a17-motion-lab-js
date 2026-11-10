import { describe, it, expect } from 'vitest';
import { LAYOUTS, CELLS, COLOUR_CELLS, pixelsOf } from '../../components/card-routing-shuffle/layouts';
import { versions } from '../../components/card-routing-shuffle/motion';
import { validateVersionMeta } from '../../lab/lib/version-meta';

describe('card-routing-shuffle', () => {
  it('has valid version meta', () => { expect(() => validateVersionMeta(versions)).not.toThrow(); });
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    it(`${name}: the visible cells tile the 3 x 3 exactly, and a column holds one colour card at most`, () => {
      expect(Object.keys(layout).sort()).toEqual([...CELLS].sort());
      const grid = Array.from({ length: 9 }, () => 0);
      for (const id of CELLS) {
        const [c, r, cs, rs, hidden] = layout[id]!;
        if (hidden) continue;
        for (let y = r; y < r + rs; y++) for (let x = c; x < c + cs; x++) grid[y * 3 + x]!++;
      }
      expect(grid).toEqual(Array.from({ length: 9 }, () => 1));
      const cols: number[] = [];
      for (const id of COLOUR_CELLS) { const [c, , cs, , hidden] = layout[id]!; if (!hidden) for (let x = c; x < c + cs; x++) cols.push(x); }
      expect(new Set(cols).size).toBe(cols.length);
    });
  }
  it('a covered cell shrinks in one dimension only', () => {
    expect(pixelsOf([0, 1, 1, 1, 'h'])).toEqual({ transform: 'translate(0px, 240px)', width: '352px', height: '0px' });
    expect(pixelsOf([1, 0, 2, 1])).toEqual({ transform: 'translate(360px, 0px)', width: '712px', height: '232px' });
  });
});
