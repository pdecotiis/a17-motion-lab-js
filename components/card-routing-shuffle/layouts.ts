// The arrangements of the 3 x 3 bento. The grid never changes: three columns, 712 tall (three rows of 232 and two gaps of 8), 1056 wide between the 8px gaps.
// Each column is a vertical stack of cells in a fixed order, and an arrangement says how many rows each cell takes (0 = collapsed) and how wide each column
// is. Cells push each other: a cell that grows pushes its neighbours, which collapse (height or width, never both), and a cell that is new to the arrangement
// comes in from the top or the bottom edge of its column (the first or last in its order) and pushes the rest. Cells can never overlap.
// The rules: each column adds up to three rows; a colour card is at most 2 rows tall, shows at most once and at most one to a column; no cell is as wide as
// two columns; and from one arrangement to the next either the stacks change or the column widths change, never both, so a cell never gets smaller in
// width and height at the same time.
export type Widths = [number, number, number];
export type Layout = { widths: Widths; rows: Record<string, number> };

/** Each column's cells, top to bottom. p = picture, v = video, y / i / g = the yellow (Machine Learning), indigo (Trading) and green (Technology) card. */
export const COLUMNS: string[][] = [
  ['y0', 'p00', 'p01', 'i0'],
  ['g1', 'p10', 'p11', 'i1'],
  ['g2', 'p20', 'p21', 'v2'],
];
export const CELLS = COLUMNS.flat();
export const kindOf = (id: string): 'picture' | 'video' | 'yellow' | 'indigo' | 'green' =>
  id[0] === 'v' ? 'video' : id[0] === 'y' ? 'yellow' : id[0] === 'i' ? 'indigo' : id[0] === 'g' ? 'green' : 'picture';
export const isColour = (id: string): boolean => ['yellow', 'indigo', 'green'].includes(kindOf(id));

const NORMAL: Widths = [352, 352, 352];
const WIDE_0: Widths = [472, 292, 292];
const WIDE_1: Widths = [292, 472, 292];
const WIDE_2: Widths = [292, 292, 472];

// stacks (rows per cell)
const A = { y0: 1, p00: 2, p10: 2, i1: 1, g2: 1, p20: 2 };                         // the page: a card on top, at the bottom, on top
const B = { p00: 2, i0: 1, g1: 1, p10: 2, p20: 2, v2: 1 };                         // indigo comes in from the bottom, green from the top
const C = { y0: 1, p00: 1, p01: 1, p10: 1, p11: 1, i1: 1, g2: 1, p20: 1, p21: 1 }; // nine cells
const D = { y0: 2, p00: 1, p10: 1, i1: 2, g2: 2, p20: 1 };                         // the cards two rows tall

export const LAYOUTS: Record<string, Layout> = {
  default: { widths: NORMAL, rows: A },
  'layout-2': { widths: WIDE_0, rows: A },
  'layout-3': { widths: WIDE_0, rows: D },
  'layout-4': { widths: NORMAL, rows: D },
  'layout-5': { widths: NORMAL, rows: C },
  'layout-6': { widths: WIDE_1, rows: C },
  'layout-7': { widths: WIDE_1, rows: B },
  'layout-8': { widths: WIDE_2, rows: B },
  'layout-9': { widths: NORMAL, rows: B },
};
export const STATE_ORDER = Object.keys(LAYOUTS);

export const ROW_H = 232, GAP = 8;
export type Box = { x: number; y: number; w: number; h: number };

/** Where a cell is and how big, in pixels: its column's stack, from the top, a gap after every cell that shows. */
export function boxOf(layout: Layout, id: string): Box {
  const col = COLUMNS.findIndex(c => c.includes(id));
  const x = layout.widths.slice(0, col).reduce((n, w) => n + w + GAP, 0);
  let y = 0;
  for (const other of COLUMNS[col]!) {
    const rows = layout.rows[other] ?? 0;
    if (other === id) return { x, y, w: layout.widths[col]!, h: rows ? rows * ROW_H + (rows - 1) * GAP : 0 };
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
