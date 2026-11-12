import type { Layout } from './layouts.js';

// The arrangements of v4 and v5. Every column is two cells: a small one (one row, a colour card) and a big one (two rows, a picture). The page's arrangement is first:
// the first column has its card on top, the second at the bottom, the third on top; the next is the opposite of it, column for column, and so on, with the pictures
// changing each time. The cards go round: every time the bento changes each colour card is presented one column to the right of where it was (it does not travel: the
// card is there in its new place), the one at the right edge goes and a new colour appears at the left. Four colours, so after four arrangements it is the first again.
// The first arrangement is primary (orange), 1 (yellow), 2 (green) across; a new colour then enters at the left in the order 3 (indigo), 2, 1, primary.
export const PAIR_LAYOUTS: Record<string, Layout> = {
  'arrangement-1': { o0: 1, p0a: 2, p1a: 2, y1: 1, g2: 1, p2a: 2 },   // orange | yellow | green    (small on top, big on top, small on top: the page)
  'arrangement-2': { p0a: 2, i0: 1, o1: 1, p1b: 2, p2a: 2, y2: 1 },   // indigo | orange | yellow
  'arrangement-3': { g0: 1, p0a: 2, p1a: 2, i1: 1, o2: 1, p2a: 2 },   // green | indigo | orange
  'arrangement-4': { p0a: 2, y0b: 1, g1: 1, p1b: 2, p2a: 2, i2: 1 },  // yellow | green | indigo
};
export const PAIR_ORDER = Object.keys(PAIR_LAYOUTS);
