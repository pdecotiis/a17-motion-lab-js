import type { Layout } from './layouts.js';

// The arrangements of v4. Every column is two cells: a small one (one row) and a big one (two rows). In the first arrangement (the page) the first column has the
// small cell on top, the second the big one on top, and the third the small one on top; the next is the opposite of it, column for column; and so on, back and forth,
// with the pictures changing each time. The cards and pictures that sit at the top in one arrangement are other cells of the same column in the next (a column's cells
// are in a fixed order, see COLUMNS in layouts.ts), so the card at the top goes and a card comes in at the bottom, and the colours swap sides as the columns do.
const SMALL_ON_TOP: Layout = { y0: 1, p0a: 2, p1a: 2, i1: 1, g2: 1, p2a: 2 };   // small, big | big, small | small, big (the page)
const BIG_ON_TOP: Layout = { p0a: 2, i0: 1, g1: 1, p1b: 2, p2a: 2, y2: 1 };     // big, small | small, big | big, small

/** a1 and b1 are the two arrangements; a2, b2, a3 and b3 are the same two again with other pictures. */
export const PAIR_LAYOUTS: Record<string, Layout> = {
  a1: SMALL_ON_TOP, b1: BIG_ON_TOP, a2: SMALL_ON_TOP, b2: BIG_ON_TOP, a3: SMALL_ON_TOP, b3: BIG_ON_TOP,
};
export const PAIR_ORDER = Object.keys(PAIR_LAYOUTS);
