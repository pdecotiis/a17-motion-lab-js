// The arrangements of the 3 x 3 bento. The grid never changes: three columns of 352, 712 tall (three rows of 232 and two gaps of 8). Each column is a vertical
// stack of cells in a fixed order, and an arrangement only says how many rows each cell takes (0 = collapsed). Cells push each other: a cell that grows pushes
// the ones next to it, which collapse (their height goes to 0 and their gap with it), and a cell that is new to the arrangement comes in from the top or the
// bottom edge of the grid, the first or last in its column's order, growing in and pushing the rest. A cell's width never changes, so a cell only ever
// changes in height: it never gets smaller by width and height at the same time, and cells can never overlap.
// The rules for an arrangement: each column adds up to three rows, each colour card shows at most once, and a column holds at most one colour card.
export type Layout = Record<string, number>;

/** Each column's cells, top to bottom. p = picture, v = video, y / i / g = the yellow, indigo and green card. */
export const COLUMNS: string[][] = [
  ['p01', 'p02', 'y0', 'i0', 'v0'],
  ['g1', 'i1', 'p11', 'p12', 'v1'],
  ['p22', 'g2', 'p21', 'v2', 'y2'],
];
export const CELLS = COLUMNS.flat();
export const kindOf = (id: string): 'picture' | 'video' | 'yellow' | 'indigo' | 'green' =>
  id[0] === 'v' ? 'video' : id[0] === 'y' ? 'yellow' : id[0] === 'i' ? 'indigo' : id[0] === 'g' ? 'green' : 'picture';
export const isColour = (id: string): boolean => ['yellow', 'indigo', 'green'].includes(kindOf(id));

const DEFAULT: Layout = { p01: 1, p02: 1, y0: 1, i1: 1, p11: 1, p12: 1, g2: 1, p21: 1, v2: 1 };
const L2: Layout = { ...DEFAULT, p01: 2, p02: 0 };
const L3: Layout = { ...L2, v2: 2, p21: 0 };
const L4: Layout = { ...L3, p11: 2, p12: 0 };

export const LAYOUTS: Record<string, Layout> = {
  default: DEFAULT,
  'layout-2': L2,
  'layout-3': L3,
  'layout-4': L4,
  // the colours come in from the bottom and the top: indigo under the tall picture, green over the tall video, a tall picture and yellow in the last column
  'layout-5': { p01: 2, i0: 1, g1: 1, v1: 2, p22: 2, y2: 1 },
  'layout-6': { i0: 2, v0: 1, g1: 1, p11: 1, p12: 1, p21: 2, y2: 1 },
  'layout-7': { p01: 1, p02: 1, y0: 1, g1: 3, p22: 1, p21: 1, v2: 1 },
  'layout-8': { p01: 1, i0: 2, p11: 2, v1: 1, g2: 1, p21: 2 },
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
