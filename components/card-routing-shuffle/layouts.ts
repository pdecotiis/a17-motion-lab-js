// The arrangements of the 3 x 3 bento. Nine cells, always the same nine; each layout says where every one sits as [column, row, columns spanned, rows spanned]
// on the grid (352 x 232 cells, 8px apart). A cell that is covered by a bigger neighbour is flagged 'w' or 'h': it shrinks to nothing in that one dimension
// where it stands (so a cell only gets smaller by width OR height) and the neighbour grows over its place.
// Cells: c1 picture, c2 indigo card, c3 green card, c4 picture, c5 picture, c6 picture, c7 yellow card, c8 picture, c9 video.
// The rules for a layout: the visible cells tile the 3 x 3 exactly, and a column holds at most one colour card.
export type Rect = [number, number, number, number] | [number, number, number, number, 'w' | 'h'];
export type Layout = Record<string, Rect>;

export const CELLS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'] as const;
export const COLOUR_CELLS = ['c2', 'c3', 'c7'] as const;

const DEFAULT: Layout = Object.fromEntries(CELLS.map((id, i) => [id, [i % 3, Math.floor(i / 3), 1, 1] as Rect]));
const from = (...overrides: Layout[]): Layout => Object.assign({}, DEFAULT, ...overrides);

const L2: Layout = from({ c1: [0, 0, 1, 2], c4: [0, 1, 1, 1, 'h'] });
const L3: Layout = from(L2, { c9: [2, 1, 1, 2], c6: [2, 1, 1, 1, 'h'] });
const L4: Layout = from(L3, { c5: [1, 1, 1, 2], c8: [1, 2, 1, 1, 'h'] });

export const LAYOUTS: Record<string, Layout> = {
  default: DEFAULT,
  'layout-2': L2,
  'layout-3': L3,
  'layout-4': L4,
  'layout-5': from({ c1: [0, 0, 1, 2], c4: [0, 1, 1, 1, 'h'], c2: [0, 2, 1, 1], c3: [1, 0, 1, 1], c5: [1, 1, 1, 1, 'h'], c9: [1, 1, 1, 2], c8: [1, 2, 1, 1, 'h'], c6: [2, 0, 1, 2], c7: [2, 2, 1, 1] }),
  'layout-6': from({ c2: [0, 0, 1, 2], c1: [0, 0, 1, 1, 'w'], c4: [0, 1, 1, 1, 'h'], c9: [0, 2, 1, 1], c7: [0, 2, 1, 1, 'h'], c5: [1, 0, 2, 1], c3: [2, 0, 1, 1, 'w'], c6: [1, 1, 2, 2], c8: [1, 2, 1, 1, 'h'] }),
  'layout-7': from({ c1: [0, 0, 2, 1], c3: [2, 0, 1, 1], c7: [0, 1, 1, 1], c5: [1, 1, 1, 1], c6: [2, 1, 1, 2], c4: [0, 2, 1, 1], c2: [1, 2, 1, 1], c8: [1, 2, 1, 1, 'h'], c9: [2, 2, 1, 1, 'h'] }),
  'layout-8': from({ c1: [0, 0, 2, 2], c4: [0, 1, 1, 1, 'h'], c5: [1, 1, 1, 1, 'w'], c3: [2, 0, 1, 1], c6: [2, 1, 1, 1], c7: [0, 2, 1, 1], c2: [1, 2, 1, 1], c8: [1, 2, 1, 1, 'h'], c9: [2, 2, 1, 1] }),
};
export const STATE_ORDER = Object.keys(LAYOUTS);

export const COL_W = 352, ROW_H = 232, GAP = 8;
/** The pixels of a rect: where it is (a translate) and how big (width and height; 0 in the dimension a covered cell has shrunk away in). */
export function pixelsOf(rect: Rect): { transform: string; width: string; height: string } {
  const [c, r, cs, rs, hidden] = rect;
  const w = cs * COL_W + (cs - 1) * GAP, h = rs * ROW_H + (rs - 1) * GAP;
  return { transform: `translate(${c * (COL_W + GAP)}px, ${r * (ROW_H + GAP)}px)`, width: hidden === 'w' ? '0px' : `${w}px`, height: hidden === 'h' ? '0px' : `${h}px` };
}
