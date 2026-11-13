import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v2: v1's bento (the same three arrangements, the 560ms expressive-standard move, the fades, the picture settle, the gutters and the pagination) with a change that mixes the two directions: a cell opens from a gap along ONE
// axis only, never both, and its other size is already the one it will have.
//   Machine learning to trading goes sideways: trading's big picture and trading's row and card open from the gap between the two columns, outward (their width grows from the gap, their height is already what it will be), while
//   machine learning's cards and big picture are pushed out to the left and right edges as they narrow. Trading to technology and technology back to machine learning go up and down as in v1: a cell opens from the gap between
//   two others, or from an edge, in height only.
// Every cell is placed on its own in the stage (its left and top are margins, its width and height are sizes, all states of the version), so a move can be sideways for some cells and vertical for others; a cell's box is its
// visible part plus an 8px gutter under it and at its right, so the gap between cells is 8px all through a move, as in v1. A cell that is shut has its box at a place and size from which it opens along one axis, and its shape is
// faded out then, so what it does between two shut states cannot be seen.
const i1 = v1.interaction!;
const X = { l: 'calc(0cqw + 0px)', r: 'calc(50cqw + 4px)', out: 'calc(100cqw + 8px)' };   // where a box starts across: the left column, the right column, past the right edge
const W = { zero: 'calc(0cqw + 0px)', full: 'calc(50cqw + 4px)' };                       // a box's width: none, or a column (its visible part and its gutter)
const Y = { top: 'calc(0cqh + 0px)', mid: 'calc(50cqh + 4px)', end: 'calc(100cqh + 8px)' };   // where a box starts down
const H = { zero: 'calc(0cqh + 0px)', half: 'calc(50cqh + 4px)', full: 'calc(100cqh + 8px)' };   // a box's height: none, a row, a column
type Box = [string, string, string, string];   // left, width, top, height
const box = (x: string, w: string, y: string, h: string): Box => [x, w, y, h];
// each cell in slide 1 (machine learning), slide 2 (trading) and slide 3 (technology)
const CELLS: Record<string, [Box, Box, Box]> = {
  'm-card': [box(X.l, W.full, Y.top, H.half), box(X.l, W.zero, Y.top, H.half), box(X.l, W.full, Y.top, H.zero)],
  'm-row': [box(X.l, W.full, Y.mid, H.half), box(X.l, W.zero, Y.mid, H.half), box(X.l, W.full, Y.end, H.zero)],
  'm-large': [box(X.r, W.full, Y.top, H.full), box(X.out, W.zero, Y.top, H.full), box(X.r, W.full, Y.top, H.zero)],
  't-large': [box(X.r, W.zero, Y.top, H.full), box(X.l, W.full, Y.top, H.full), box(X.l, W.full, Y.mid, H.zero)],
  't-row': [box(X.r, W.zero, Y.top, H.half), box(X.r, W.full, Y.top, H.half), box(X.r, W.full, Y.top, H.zero)],
  't-card': [box(X.r, W.zero, Y.mid, H.half), box(X.r, W.full, Y.mid, H.half), box(X.r, W.full, Y.end, H.zero)],
  'e-card': [box(X.l, W.full, Y.mid, H.zero), box(X.l, W.full, Y.top, H.zero), box(X.l, W.full, Y.top, H.half)],
  'e-row': [box(X.l, W.full, Y.mid, H.zero), box(X.l, W.full, Y.end, H.zero), box(X.l, W.full, Y.mid, H.half)],
  'e-large': [box(X.r, W.full, Y.end, H.zero), box(X.r, W.full, Y.mid, H.zero), box(X.r, W.full, Y.top, H.full)],
};
const slideOf = (state: string): number => (state === 'slide-0' ? 0 : Number(state.slice(-1)) - 1);
const MOVE = { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-standard' };
const layers = { ...i1.layers! };
for (const [id, boxes] of Object.entries(CELLS)) {
  layers[id] = {
    states: Object.fromEntries(Object.keys(i1.states).map(s => { const [x, w, y, h] = boxes[slideOf(s)]!; return [s, { marginLeft: x, width: w, marginTop: y, height: h }]; })),
    transitions: Object.fromEntries(Object.keys(i1.states).map(s => [s, MOVE])),
  };
}
// the stylesheet places the cells on their own for a version that sets this (the stage's column gap is not used: cells are placed by their margins)
layers['stage'] = { states: Object.fromEntries(Object.keys(i1.states).map(s => [s, { columnGap: '0px' }])), transitions: Object.fromEntries(Object.keys(i1.states).map(s => [s, MOVE])) };

export const v2: MotionVersion = {
  ...v1,
  id: 'v2',
  label: 'Machine learning to trading goes sideways (cells open from the gap between the columns, one axis only); the other changes go up and down',
  interaction: { ...i1, layers },
  forkedFrom: 'v1',
};

export default v2;
