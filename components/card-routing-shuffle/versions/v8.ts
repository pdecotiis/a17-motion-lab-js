import type { MotionVersion } from '../../../lab/lib/types.js';
import { CELLS, isColour, sizeOf } from '../layouts.js';
import { CELL_PHOTOS, FIXED_LAYOUTS, FIXED_ORDER, FIXED_PICTURE_OF, fixedLayerName } from '../layouts-fixed.js';
import { v6 } from './v6.js';

// v8: v6, with two arrangements (v6's first and its flip) where each column keeps its identity (layouts-fixed.ts): Machine Learning is always the first column, Trading the second, Technology the third.
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
const timingOf = (name: string, fallback: string) => of6(name.startsWith('pic-') && !v6Layers[name] ? fallback : name).transitions;
// i1t is new (a Trading card on top of the second column): it takes the timing of that column's other cell, y1
const keep = (t: NonNullable<(typeof v6Layers)[string]['transitions']>) => Object.fromEntries(Object.entries(t).filter(([k]) => ALL.includes(k)));
const of6 = (name: string) => { const l = v6Layers[name] ?? v6Layers[name.replace('i1t', 'y1')]!; return { transitions: l.transitions && keep(l.transitions) }; };

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const id of CELLS) layers[id] = { states: each(s => gutterSizeOf(layoutOf(s), id)), transitions: of6(id).transitions };
for (const id of CELLS.filter(isColour)) {
  const shown = each(s => ({ opacity: sizeOf(layoutOf(s), id).height === '0%' ? 0 : 1 }));
  layers[`title-${id}`] = { states: shown, transitions: of6(`title-${id}`).transitions };
  layers[`arrow-${id}`] = { states: shown, transitions: of6(`arrow-${id}`).transitions };
}
// the pictures: each arrangement shows its own; the opening's 'cards-only' looks like the first
for (const [cell, photos] of Object.entries(CELL_PHOTOS)) {
  for (const n of photos) {
    const name = fixedLayerName(cell, `photo-${n}.jpg`);
    // a picture does not fade out while its cell scales away: it goes only once the cell has closed (see v4)
    const own = timingOf(name, cell) ?? {};
    layers[name] = {
      states: each(s => ({ opacity: FIXED_PICTURE_OF[s === INTRO ? FIXED_ORDER[0]! : s]?.[cell] === `photo-${n}.jpg` ? 1 : 0 })),
      transitions: each(s => (sizeOf(layoutOf(s), cell).height === '0%' ? { model: 'tween' as const, duration: 'duration.100', easing: 'easing.linear', delay: 'duration.470' } : own[s] ?? own[Object.keys(own)[0]!]!)),
    };
  }
}
// the controls' entrance (pager, float) are v6's
for (const name of ['pager', 'float']) layers[name] = { ...v6Layers[name]!, states: each(s => v6Layers[name]!.states[s] ?? {}) };

// the triggers are v6's: the arrows and the loop go round the four, each bullet goes to its own
const ORDER = FIXED_ORDER as [string, string, ...string[]];
const triggers = i6.triggers!.map(t => {
  const r = t as { toggle?: string[] };
  return r.toggle && r.toggle.includes('arrangement-1') ? { ...t, toggle: (r.toggle[0] === 'arrangement-1' ? ORDER : [...ORDER].reverse()) } : t;
}) as NonNullable<MotionVersion['interaction']>['triggers'];

export const v8: MotionVersion = {
  ...v6,
  id: 'v8',
  label: 'Fixed columns, four arrangements: the cards move inside their columns',
  interaction: { ...i6, layers, triggers, states: each(() => ({})), transitions: Object.fromEntries(Object.entries(i6.transitions!).filter(([k]) => ALL.includes(k))) },
  elements: { ...v6.elements, i1t: 'card' },
  forkedFrom: 'v6',
};

export default v8;
