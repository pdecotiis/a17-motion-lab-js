import { COLUMNS, type Layout } from './layouts.js';
import { PAIR_PICTURE_OF, CELL_PHOTOS } from './pictures.js';

// v8: v6's flip, in four arrangements, with the columns keeping their identity. The columns keep their identity. Machine Learning is always the first column, Trading the second and Technology the third (the opening's order: the cards come in as
// o0, y1, g2). What changes from one arrangement to the next is what is inside the column: the sizes of the cells, which cell is on top, the picture, and the colour of the card.
// The small cards alternate: top, bottom, top in one arrangement and bottom, top, bottom in the next (never all three on one line, so neither are the three pictures), and a small card is always at the top or the bottom of its column.
// Every colour cell carries its column's label (i1t is a Trading card added on top of the second column, so Trading can flip to the top). A column adds up to three rows, no cell takes more than two.
// A column is four cells in a row: a card for the top, a picture (A), a picture (B), a card for the bottom. When the card is at the bottom the column shows picture A over it; when the card is at the top it shows picture B under it. So going
// from one to the other the new picture always opens between the picture that is going and the card, and pushes the others out (the middle column's old way, now in all three columns).
export const FIXED_LAYOUTS: Record<string, Layout> = {
  'arrangement-1': { o0: 1, p0b: 2, p1a: 2, y1: 1, g2: 1, v2: 2 },   // card on top | card at the bottom | card on top: orange, yellow, green
  'arrangement-2': { p0a: 2, y0b: 1, i1t: 1, p1b: 2, p2a: 2, y2: 1 },   // bottom | top | bottom: yellow, indigo, green
  'arrangement-3': { o0: 1, p0b: 2, p1a: 2, i1: 1, g2: 1, v2: 2 },   // top | bottom | top: orange, indigo, green
  'arrangement-4': { p0a: 2, y0b: 1, i1t: 1, p1b: 2, p2a: 2, y2: 1 },   // bottom | top | bottom: yellow, indigo, green (other pictures than the second)
};
export const FIXED_ORDER = Object.keys(FIXED_LAYOUTS);
export const COLUMN_LABELS = ['Machine Learning', 'Trading', 'Technology'];
/** The label each colour card carries in the markup (its column's). */
export const CARD_LABEL: Record<string, string> = { o0: COLUMN_LABELS[0]!, y0: COLUMN_LABELS[0]!, y0b: COLUMN_LABELS[0]!, y1: COLUMN_LABELS[1]!, i1t: COLUMN_LABELS[1]!, i1: COLUMN_LABELS[1]!, g2: COLUMN_LABELS[2]!, y2: COLUMN_LABELS[2]! };

export { CELL_PHOTOS } from './pictures.js';

/** Which picture each cell shows in each arrangement: the first is v4's (so the opening looks the same), the others the first of the cell's own that is free:
 *  none twice in an arrangement, none shared with the arrangement before or the one after (the last and the first count as neighbours). */
function assign(): Record<string, Record<string, string>> {
  const of: Record<string, Record<string, string>> = {};
  const shown: Record<string, Set<string>> = {};   // what each cell has shown so far: it picks a new one before it repeats
  FIXED_ORDER.forEach((state, k) => {
    const avoid = new Set([FIXED_ORDER[(k + FIXED_ORDER.length - 1) % FIXED_ORDER.length]!, FIXED_ORDER[(k + 1) % FIXED_ORDER.length]!].flatMap(s => Object.values(of[s] ?? {})));
    of[state] = {};
    for (const cell of COLUMNS.flat().filter(id => FIXED_LAYOUTS[state]![id] && id in CELL_PHOTOS)) {
      const used = new Set(Object.values(of[state]!));
      const list = CELL_PHOTOS[cell]!.map(n => `photo-${n}.jpg`);
      const seen = (shown[cell] ??= new Set());
      const fromPairs = k === 0 ? PAIR_PICTURE_OF['arrangement-1']?.[cell] : undefined;   // the opening's own picture, where v4 had one
      const pick = fromPairs ?? list.find(p => !used.has(p) && !avoid.has(p) && !seen.has(p)) ?? list.find(p => !used.has(p) && !avoid.has(p))!;
      of[state]![cell] = pick;
      seen.add(pick);
    }
  });
  return of;
}
export const FIXED_PICTURE_OF = assign();
/** The name of an image element (its data-motion) for a cell's picture. */
export const fixedLayerName = (cell: string, picture: string): string => `pic-${cell}-${CELL_PHOTOS[cell]!.indexOf(Number(/\d+/.exec(picture)![0])) + 1}`;
