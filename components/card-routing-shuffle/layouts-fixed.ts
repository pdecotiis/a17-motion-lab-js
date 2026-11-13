import { COLUMNS, type Layout } from './layouts.js';
import { PAIR_PICTURE_OF } from './pictures.js';

// v8: v6's two-way flip, with the columns keeping their identity. The columns keep their identity. Machine Learning is always the first column, Trading the second and Technology the third (the opening's order: the cards come in as
// o0, y1, g2). What changes from one arrangement to the next is what is inside the column: the sizes of the cells, which cell is on top, the picture, and the colour of the card.
// Every colour cell carries its column's label (i1t is a Trading card added on top of the second column, so Trading can flip to the top). A column adds up to three rows, no cell takes more than two.
export const FIXED_LAYOUTS: Record<string, Layout> = {
  'arrangement-1': { o0: 1, p0a: 2, p1a: 2, y1: 1, g2: 1, p2a: 2 },   // v6's first: small card, big picture | big picture, small card | small card, big picture
  'arrangement-2': { p0b: 2, y0b: 1, i1t: 1, p1b: 2, v2: 2, y2: 1 },   // the flip, column for column: big picture, small card | small card, big picture | big picture, small card
};
export const FIXED_ORDER = Object.keys(FIXED_LAYOUTS);
export const COLUMN_LABELS = ['Machine Learning', 'Trading', 'Technology'];
/** The label each colour card carries in the markup (its column's). */
export const CARD_LABEL: Record<string, string> = { o0: COLUMN_LABELS[0]!, y0: COLUMN_LABELS[0]!, y0b: COLUMN_LABELS[0]!, y1: COLUMN_LABELS[1]!, i1t: COLUMN_LABELS[1]!, i1: COLUMN_LABELS[1]!, g2: COLUMN_LABELS[2]!, y2: COLUMN_LABELS[2]! };

/** The pictures each cell holds in the markup, in the order of its image elements (pic-<cell>-<n>). */
export const CELL_PHOTOS: Record<string, number[]> = {
  p0a: [1, 4, 9, 14, 11, 7, 10, 13], p0b: [10, 1, 6, 12], p1a: [2, 5, 7, 8, 14], p1b: [6, 11, 3, 8, 13, 5], p2a: [3, 7, 12, 4, 9, 14, 6, 1], v2: [8, 13, 5, 10, 4],
};

/** Which picture each cell shows in each arrangement: the first is v4's (so the opening looks the same), the others the first of the cell's own that is free:
 *  none twice in an arrangement, none shared with the arrangement before or the one after (the last and the first count as neighbours). */
function assign(): Record<string, Record<string, string>> {
  const of: Record<string, Record<string, string>> = { [FIXED_ORDER[0]!]: { ...PAIR_PICTURE_OF['arrangement-1'] } };
  FIXED_ORDER.slice(1).forEach((state, k) => {
    const k1 = k + 1, avoid = new Set([FIXED_ORDER[k1 - 1]!, FIXED_ORDER[0]!].flatMap(s => Object.values(of[s]!)));
    of[state] = {};
    for (const cell of COLUMNS.flat().filter(id => FIXED_LAYOUTS[state]![id] && id in CELL_PHOTOS)) {
      const used = new Set(Object.values(of[state]!));
      const list = CELL_PHOTOS[cell]!.map(n => `photo-${n}.jpg`);
      const pick = list.find(p => !used.has(p) && !avoid.has(p))!;
      of[state]![cell] = pick;
    }
  });
  return of;
}
export const FIXED_PICTURE_OF = assign();
/** The name of an image element (its data-motion) for a cell's picture. */
export const fixedLayerName = (cell: string, picture: string): string => `pic-${cell}-${CELL_PHOTOS[cell]!.indexOf(Number(/\d+/.exec(picture)![0])) + 1}`;
