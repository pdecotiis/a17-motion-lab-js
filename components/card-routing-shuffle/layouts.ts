// The arrangements of the 3 x 3 bento. Nine cells, always the same nine; each layout says where every one sits as [column, row, columns spanned, rows spanned]
// on the grid (352 x 232 cells, 8px apart). A cell that is covered by a bigger neighbour is flagged 'w' or 'h': it shrinks to nothing in that one dimension
// where it stands (so a cell only gets smaller by width OR height) and the neighbour grows over its place.
// Cells: c1 picture, c2 indigo card, c3 green card, c4 picture, c5 picture, c6 picture, c7 yellow card, c8 picture, c9 video.
// The rules for a layout: the visible cells tile the 3 x 3 exactly, and a column holds at most one colour card.
export type Hidden = 'w-' | 'w+' | 'h-' | 'h+';
export type Rect = [number, number, number, number] | [number, number, number, number, Hidden];
export type Layout = Record<string, Rect>;

export const CELLS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'] as const;
export const COLOUR_CELLS = ['c2', 'c3', 'c7'] as const;

const DEFAULT: Layout = Object.fromEntries(CELLS.map((id, i) => [id, [i % 3, Math.floor(i / 3), 1, 1] as Rect]));
const from = (...overrides: Layout[]): Layout => Object.assign({}, DEFAULT, ...overrides);

// A cell only grows from its own place (its slot in the default arrangement) over the cells next to it, and those cells are the ones that shrink away, so
// the cells push each other: nothing moves across the grid and nothing overlaps.
const L2: Layout = from({ c1: [0, 0, 1, 2], c4: [0, 1, 1, 1, 'h+'] });
const L3: Layout = from(L2, { c9: [2, 1, 1, 2], c6: [2, 1, 1, 1, 'h-'] });
const L4: Layout = from(L3, { c5: [1, 1, 1, 2], c8: [1, 2, 1, 1, 'h+'] });

// The order matters: from one arrangement to the next, no two cells may cross each other (overlapsBetween, checked by a unit test), and the order below is one
// where none do. A cell that is covered shrinks toward the side the neighbour pushes from, and one that is pushed past the edge of the grid ends below it.
export const LAYOUTS: Record<string, Layout> = {
  default: DEFAULT,
  'layout-2': L2,
  'layout-3': L3,
  'layout-4': L4,
  'layout-5': from({ c2: [1, 0, 1, 3], c5: [1, 3, 1, 1, 'h-'], c8: [1, 3, 1, 1, 'h-'] }),
  'layout-6': from({ c3: [1, 0, 2, 1], c2: [1, 0, 1, 1, 'w-'] }),
  'layout-7': from({ c4: [0, 1, 2, 1], c5: [1, 1, 1, 1, 'w+'], c9: [1, 2, 2, 1], c8: [1, 2, 1, 1, 'w-'] }),
  'layout-8': from({ c1: [0, 0, 2, 2], c2: [1, 0, 1, 1, 'w+'], c4: [0, 1, 1, 1, 'h+'], c5: [1, 1, 1, 1, 'h+'] }),
  'layout-9': from({ c6: [1, 1, 2, 2], c5: [1, 1, 1, 1, 'w-'], c8: [1, 2, 1, 1, 'h+'], c9: [2, 2, 1, 1, 'h+'] }),
};
export const STATE_ORDER = Object.keys(LAYOUTS);

export const COL_W = 352, ROW_H = 232, GAP = 8;
/** The box of a rect in pixels. A covered cell has zero size in the dimension it shrinks away in, and sits at the side it shrinks toward. */
export function boxOf(rect: Rect): { x: number; y: number; w: number; h: number } {
  const [c, r, cs, rs, hidden] = rect;
  let x = c * (COL_W + GAP), y = r * (ROW_H + GAP), w = cs * COL_W + (cs - 1) * GAP, h = rs * ROW_H + (rs - 1) * GAP;
  if (hidden === 'h-' ) h = 0;
  if (hidden === 'h+') { y += h + GAP; h = 0; }
  if (hidden === 'w-') w = 0;
  if (hidden === 'w+') { x += w + GAP; w = 0; }
  return { x, y, w, h };
}
export function pixelsOf(rect: Rect): { transform: string; width: string; height: string } {
  const b = boxOf(rect);
  return { transform: `translate(${b.x}px, ${b.y}px)`, width: `${b.w}px`, height: `${b.h}px` };
}

/** Whether two cells, each moving in a straight line from its box in one arrangement to its box in the next, can overlap on the way: they cannot when one
 *  stays on the same side of the other, on the same axis, at the start and at the end. */
export function mayOverlap(a0: Rect, a1: Rect, b0: Rect, b1: Rect): boolean {
  const A0 = boxOf(a0), A1 = boxOf(a1), B0 = boxOf(b0), B1 = boxOf(b1);
  const sep = (p: typeof A0, q: typeof A0, axis: 'x' | 'y') => axis === 'x' ? q.x - (p.x + p.w) : q.y - (p.y + p.h);
  for (const axis of ['x', 'y'] as const) {
    if (sep(A0, B0, axis) >= 0 && sep(A1, B1, axis) >= 0) return false;
    if (sep(B0, A0, axis) >= 0 && sep(B1, A1, axis) >= 0) return false;
  }
  return true;
}
/** The pairs of cells that can overlap while the bento goes from one arrangement to the next. */
export function overlapsBetween(from: Layout, to: Layout): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < CELLS.length; i++) for (let j = i + 1; j < CELLS.length; j++) {
    const a = CELLS[i]!, b = CELLS[j]!;
    if (mayOverlap(from[a]!, to[a]!, from[b]!, to[b]!)) out.push([a, b]);
  }
  return out;
}
