import { describe, it, expect } from 'vitest';
import { LAYOUTS, STATE_ORDER } from '../../components/card-routing-shuffle/layouts';
import { PICTURE_CELLS, PICTURE_OF, POOL } from '../../components/card-routing-shuffle/pictures';

// The pictures change each time the bento does, and are not reused: not twice in an arrangement, not in two arrangements next to each other.
describe('the shuffle bento pictures', () => {
  const picturesOf = (state: string): string[] => Object.values(PICTURE_OF[state]!);
  it('every picture cell that shows has a picture, and a hidden one has none', () => {
    for (const state of STATE_ORDER) {
      for (const cell of PICTURE_CELLS) expect(PICTURE_OF[state]![cell] !== undefined, `${state} ${cell}`).toBe((LAYOUTS[state]![cell] ?? 0) > 0);
    }
  });
  it('no picture shows twice in one arrangement', () => {
    for (const state of STATE_ORDER) expect(new Set(picturesOf(state)).size, state).toBe(picturesOf(state).length);
  });
  it('no picture stays when the bento changes: the next arrangement (and the first after the last) shows none of the same', () => {
    STATE_ORDER.forEach((state, k) => {
      const next = STATE_ORDER[(k + 1) % STATE_ORDER.length]!;
      expect(picturesOf(state).filter(p => picturesOf(next).includes(p)), `${state} -> ${next}`).toEqual([]);
    });
  });
  it('only uses the pictures there are', () => {
    for (const state of STATE_ORDER) for (const p of picturesOf(state)) expect(POOL).toContain(p);
  });
});
