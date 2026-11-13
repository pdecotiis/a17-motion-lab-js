import type { MotionVersion } from '../../../lab/lib/types.js';
import { CELLS, isColour, sizeOf } from '../layouts.js';
import { CELL_PHOTOS, FIXED_LAYOUTS, FIXED_ORDER, FIXED_PICTURE_OF, fixedLayerName } from '../layouts-fixed.js';
import { v6 } from './v6.js';

// v8: v6, with arrangements where each column keeps its identity (layouts-fixed.ts): Machine Learning is always the first column, Trading the second, Technology the third.
// What changes from one arrangement to the next is inside the column (the sizes of the cells, which one is on top, the pictures, the colour of the card), so the bento morphs in place and
// the cards do not go round. Everything else is v6's: the opening, the first move (its timing and column delays), the controls' entrance, the arrows, the bullets, the play / pause and the five-second loop.
const i6 = v6.interaction!;
const INTRO = 'cards-only';
const CARDS_ONLY = { o0: 1, y1: 1, g2: 1 };
const ALL = [INTRO, ...FIXED_ORDER];
const each = <T>(f: (s: string) => T): Record<string, T> => Object.fromEntries(ALL.map(s => [s, f(s)]));
const layoutOf = (s: string) => (s === INTRO ? CARDS_ONLY : FIXED_LAYOUTS[s]!);
// a cell's box is its visible part plus the 8px gutter below it (see v4)
const gutterSizeOf = (layout: Parameters<typeof sizeOf>[0], id: string) => {
  const { height } = sizeOf(layout, id);
  return { height: height === '0%' ? 'calc(0% + 0px)' : `calc(${height} + 8px)`, marginTop: '0px', marginBottom: '0px' };
};
const v6Layers = i6.layers!;
const timingOf = (name: string, fallback: string) => (v6Layers[name] ?? v6Layers[fallback]!).transitions;

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const id of CELLS) layers[id] = { states: each(s => gutterSizeOf(layoutOf(s), id)), transitions: v6Layers[id]!.transitions };
for (const id of CELLS.filter(isColour)) {
  const shown = each(s => ({ opacity: sizeOf(layoutOf(s), id).height === '0%' ? 0 : 1 }));
  layers[`title-${id}`] = { states: shown, transitions: v6Layers[`title-${id}`]!.transitions };
  layers[`arrow-${id}`] = { states: shown, transitions: v6Layers[`arrow-${id}`]!.transitions };
}
// the pictures: each arrangement shows its own; the opening's 'cards-only' looks like the first
for (const [cell, photos] of Object.entries(CELL_PHOTOS)) {
  for (const n of photos) {
    const name = fixedLayerName(cell, `photo-${n}.jpg`);
    layers[name] = { states: each(s => ({ opacity: FIXED_PICTURE_OF[s === INTRO ? FIXED_ORDER[0]! : s]?.[cell] === `photo-${n}.jpg` ? 1 : 0 })), transitions: timingOf(name, cell) };
  }
}
// the controls' entrance (pager, float) are v6's
for (const name of ['pager', 'float']) layers[name] = v6Layers[name]!;

export const v8: MotionVersion = {
  ...v6,
  id: 'v8',
  label: 'Fixed columns: Machine Learning, Trading, Technology keep their column; what is inside changes',
  interaction: { ...i6, layers },
  forkedFrom: 'v6',
};

export default v8;
