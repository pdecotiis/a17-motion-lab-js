import { describe, it, expect } from 'vitest';
import { COLUMNS, CELLS, boxOf, overlapsBetween } from '../../components/card-routing-shuffle/layouts';
import { PAIR_LAYOUTS, PAIR_ORDER } from '../../components/card-routing-shuffle/layouts-pairs';
import { PAIR_PICTURE_OF } from '../../components/card-routing-shuffle/pictures';

// v4: every column is a small cell and a big one; each arrangement is the opposite of the one before; the pictures change each time.
describe('the shuffle bento v4 arrangements', () => {
  it('every column is a small cell (one row) and a big one (two rows)', () => {
    for (const state of PAIR_ORDER) {
      for (const column of COLUMNS) expect(column.map(id => PAIR_LAYOUTS[state]![id] ?? 0).filter(rows => rows > 0).sort(), `${state} ${column.join()}`).toEqual([1, 2]);
    }
  });
  it('the first is the page (small, big | big, small | small, big) and each is the opposite of the one before, column for column', () => {
    const topOf = (state: string): number[] => COLUMNS.map(column => column.map(id => PAIR_LAYOUTS[state]![id] ?? 0).find(rows => rows > 0)!);
    expect(topOf('arrangement-1')).toEqual([1, 2, 1]);
    PAIR_ORDER.forEach((state, k) => {
      const next = PAIR_ORDER[(k + 1) % PAIR_ORDER.length]!;
      expect(topOf(next), `${state} -> ${next}`).toEqual(topOf(state).map(rows => 3 - rows));
    });
  });
  it('the colour cards go round: each is one column to the right of where it was, a new colour enters at the left, and after four it is the first again', () => {
    const colourAt = (state: string): (string | undefined)[] => COLUMNS.map(column => column.find(id => /^[oyig]/.test(id) && (PAIR_LAYOUTS[state]![id] ?? 0) > 0)?.[0]);
    expect(PAIR_ORDER).toHaveLength(4);
    PAIR_ORDER.forEach((state, k) => {
      const now = colourAt(state), next = colourAt(PAIR_ORDER[(k + 1) % 4]!);
      expect(now.every(Boolean), state).toBe(true);
      expect(next.slice(1), `${state} -> next`).toEqual(now.slice(0, 2));
    });
    expect(colourAt('arrangement-1')).toEqual(['o', 'y', 'g']);   // the page: primary, 1, 2 across
  });
  it('the cells push each other: nothing overlaps from one arrangement to the next', () => {
    PAIR_ORDER.forEach((state, k) => expect(overlapsBetween(PAIR_LAYOUTS[state]!, PAIR_LAYOUTS[PAIR_ORDER[(k + 1) % PAIR_ORDER.length]!]!), state).toEqual([]));
  });
  it('each column fills its height', () => {
    for (const state of PAIR_ORDER) for (const column of COLUMNS) {
      const shown = column.map(id => boxOf(PAIR_LAYOUTS[state]!, id)).filter(b => b.h > 0), last = shown[shown.length - 1]!;
      expect(last.y + last.h, `${state} ${column.join()}`).toBe(712);
    }
    expect(CELLS.length).toBeGreaterThan(0);
  });
  it('the pictures change each time: none shows twice in an arrangement, none stays when the bento changes', () => {
    PAIR_ORDER.forEach((state, k) => {
      const pictures = Object.values(PAIR_PICTURE_OF[state]!), next = Object.values(PAIR_PICTURE_OF[PAIR_ORDER[(k + 1) % PAIR_ORDER.length]!]!);
      expect(new Set(pictures).size, state).toBe(pictures.length);
      expect(pictures.filter(p => next.includes(p)), `${state} -> next`).toEqual([]);
    });
  });
});
