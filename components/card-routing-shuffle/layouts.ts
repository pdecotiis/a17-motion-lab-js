// The bento, reduced to its core: three columns in a fixed frame (352 wide, 712 tall: three rows of 232 and two gaps of 8). Every column holds one colour card and
// one picture, in the order the page has them (a card on top in the first and last column, at the bottom in the middle one). The one thing that changes is how
// the column's three rows are split: the card takes 0, 1 or 2 rows and the picture takes the rest (a card of 0 rows is gone and the picture fills the column).
// The card and its picture trade height, so they push each other and never overlap, and a cell only ever changes in height. Any number of cards may show.
export type Layout = Record<string, number>;

/** Each column's cells, top to bottom: the colour card (y = yellow Machine Learning, i = indigo Trading, g = green Technology) and the picture (p) or video (v). */
export const COLUMNS: string[][] = [['y0', 'p0'], ['p1', 'i1'], ['g2', 'v2']];
export const CELLS = COLUMNS.flat();
export const kindOf = (id: string): 'picture' | 'video' | 'yellow' | 'indigo' | 'green' =>
  id[0] === 'v' ? 'video' : id[0] === 'y' ? 'yellow' : id[0] === 'i' ? 'indigo' : id[0] === 'g' ? 'green' : 'picture';
export const isColour = (id: string): boolean => ['yellow', 'indigo', 'green'].includes(kindOf(id));
const CARD = ['y0', 'i1', 'g2'], PICTURE = ['p0', 'p1', 'v2'];

/** An arrangement from the rows each column's card takes: [first, middle, last]. */
const layoutOf = (cards: [number, number, number]): Layout =>
  Object.fromEntries(cards.flatMap((c, i) => [[CARD[i]!, c], [PICTURE[i]!, 3 - c]]));

export const LAYOUTS: Record<string, Layout> = {
  default: layoutOf([1, 1, 1]),     // the page
  'layout-2': layoutOf([2, 1, 1]),
  'layout-3': layoutOf([2, 2, 1]),
  'layout-4': layoutOf([2, 2, 2]),
  'layout-5': layoutOf([1, 0, 2]),
  'layout-6': layoutOf([0, 0, 0]),  // no cards at all
  'layout-7': layoutOf([0, 2, 1]),
  'layout-8': layoutOf([1, 2, 0]),
};
export const STATE_ORDER = Object.keys(LAYOUTS);

export const COL_W = 352, ROW_H = 232, GAP = 8;
export type Box = { x: number; y: number; w: number; h: number };

/** Where a cell is and how big, in pixels: its column's stack, from the top, a gap after every cell that shows. */
export function boxOf(layout: Layout, id: string): Box {
  const col = COLUMNS.findIndex(c => c.includes(id));
  let y = 0;
  for (const other of COLUMNS[col]!) {
    const rows = layout[other] ?? 0;
    if (other === id) return { x: col * (COL_W + GAP), y, w: COL_W, h: rows ? rows * ROW_H + (rows - 1) * GAP : 0 };
    if (rows) y += rows * ROW_H + (rows - 1) * GAP + GAP;
  }
  throw new Error(`no such cell: ${id}`);
}
/** What a cell's states set: its height, and the gap under it (a cell that shows has 8px below it, a collapsed one none), so the column's stack does the pushing. */
export function sizeOf(layout: Layout, id: string): { height: string; marginBottom: string } {
  const b = boxOf(layout, id);
  return { height: `${b.h}px`, marginBottom: b.h ? `${GAP}px` : '0px' };
}

/** The pairs of cells that can overlap while the bento goes from one arrangement to the next, each cell moving in a straight line from its box to its box:
 *  they cannot when one stays on the same side of the other, on the same axis, at the start and at the end. */
export function overlapsBetween(from: Layout, to: Layout): [string, string][] {
  const gap = (p: Box, q: Box, axis: 'x' | 'y') => axis === 'x' ? q.x - (p.x + p.w) : q.y - (p.y + p.h);
  const out: [string, string][] = [];
  for (let i = 0; i < CELLS.length; i++) for (let j = i + 1; j < CELLS.length; j++) {
    const a = CELLS[i]!, b = CELLS[j]!, a0 = boxOf(from, a), a1 = boxOf(to, a), b0 = boxOf(from, b), b1 = boxOf(to, b);
    const apart = (['x', 'y'] as const).some(ax => (gap(a0, b0, ax) >= 0 && gap(a1, b1, ax) >= 0) || (gap(b0, a0, ax) >= 0 && gap(b1, a1, ax) >= 0));
    if (!apart) out.push([a, b]);
  }
  return out;
}
