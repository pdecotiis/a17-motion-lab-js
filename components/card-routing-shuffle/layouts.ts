// The bento, reduced to its core: three columns in a fixed frame (352 wide, 712 tall: three rows of 232 and two gaps of 8). Each column is a vertical stack of
// cells in a fixed order (colour cards at the top and the bottom of the stack, pictures between), and an arrangement says how many rows each cell takes
// (0 = collapsed). The cells trade height, so they push each other and never overlap, and a cell only ever changes in height. A cell that is new to an
// arrangement comes in from the top or the bottom of its column, growing in and pushing the rest away. Rules: each column adds up to three rows, no
// cell takes more than 2 (so no tall pictures), and each colour card shows at most once. The first arrangement shows all three cards, the others one.
export type Layout = Record<string, number>;

/** Each column's cells, top to bottom: the colour card (y = yellow Machine Learning, i = indigo Trading, g = green Technology) and the picture (p) or video (v). */
export const COLUMNS: string[][] = [['y0', 'p0a', 'p0b', 'i0'], ['g1', 'p1a', 'p1b', 'i1'], ['g2', 'p2a', 'v2', 'y2']];
export const CELLS = COLUMNS.flat();
export const kindOf = (id: string): 'picture' | 'video' | 'yellow' | 'indigo' | 'green' =>
  id[0] === 'v' ? 'video' : id[0] === 'y' ? 'yellow' : id[0] === 'i' ? 'indigo' : id[0] === 'g' ? 'green' : 'picture';
export const isColour = (id: string): boolean => ['yellow', 'indigo', 'green'].includes(kindOf(id));

export const LAYOUTS: Record<string, Layout> = {
  default: { y0: 1, p0a: 2, p1a: 2, i1: 1, g2: 1, p2a: 2 },                       // the page: a card on top, at the bottom, on top
  // then one card at a time, the rest pictures: it comes in from the top or the bottom of its column and the pictures give way
  'layout-2': { p0a: 2, i0: 1, p1a: 1, p1b: 2, p2a: 2, v2: 1 },                     // indigo, from the bottom
  'layout-3': { p0a: 1, p0b: 2, g1: 2, p1b: 1, p2a: 1, v2: 2 },                     // green, from the top, two rows
  'layout-4': { p0a: 2, p0b: 1, p1a: 2, p1b: 1, p2a: 1, v2: 1, y2: 1 },             // yellow, from the bottom
  'layout-5': { y0: 2, p0b: 1, p1a: 1, p1b: 2, p2a: 2, v2: 1 },                     // yellow, from the top, two rows
  'layout-6': { p0a: 1, p0b: 2, p1b: 1, i1: 2, p2a: 2, v2: 1 },                     // indigo, from the bottom, two rows
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
/** The height of a column (px at the design width): a cell's height is written as a share of it, so the bento scales with its container and keeps these proportions. */
export const GRID_H = 712;
/** What a cell's states set: its height as a share of its column, and the gap under it (a cell that shows has 8px below it, a collapsed one none), so the column's stack does the pushing. */
export function sizeOf(layout: Layout, id: string): { height: string; marginBottom: string } {
  const b = boxOf(layout, id);
  return { height: `${Math.round((b.h / GRID_H) * 100000) / 1000}%`, marginBottom: b.h ? `${GAP}px` : '0px' };
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
