import type { MotionVersion } from '../../../lab/lib/types.js';
import { CELLS, LAYOUTS, STATE_ORDER, sizeOf } from '../layouts.js';

// v1: a 3 x 3 bento that shuffles. Each column is a stack of cells and every cell is its own layer that changes height (and the gap under it) to its place in
// the next arrangement, so a cell that grows pushes the ones next to it, which collapse, and a new one comes in from the top or bottom. The shuffle button
// below goes to the next arrangement on each click, and back to the first after the last. The colour cards come in first with the card entrance preset and
// respond to the pointer with the card preset (hover tint, press scale). Every cell masks its picture, which fills it.
const MOVE = { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-standard' };
const each = <T>(f: (s: string) => T): Record<string, T> => Object.fromEntries(STATE_ORDER.map(s => [s, f(s)]));

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const id of CELLS) {
  layers[id] = { states: each(s => sizeOf(LAYOUTS[s]!, id)), transitions: each(() => MOVE) };
}
// the columns change width (a column that grows takes the width the others give up)
([0, 1, 2] as const).forEach(c => { layers[`col-${c}`] = { states: each(s => ({ width: `${LAYOUTS[s]!.widths[c]}px` })), transitions: each(() => MOVE) }; });

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Shuffle',
  // the grid fades in quickly and the colour cards of the first arrangement rise in one after another (reading order)
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: { y0: { preset: 'card' }, g2: { preset: 'card', delay: 'delay.40' }, i1: { preset: 'card', delay: 'delay.70' } },
  interaction: {
    initial: 'default',
    states: each(() => ({})),
    transitions: each(() => MOVE),
    layers,
    triggers: [{ on: 'click', toggle: STATE_ORDER as [string, string, ...string[]], target: 'shuffle' }],
  },
  elements: { shuffle: 'button', y0: 'card', y2: 'card', i0: 'card', i1: 'card', g1: 'card', g2: 'card' },
  lineage: 'new, from the Figma "9 cell grid" frames (page home, xl · open)',
};

export default v1;
