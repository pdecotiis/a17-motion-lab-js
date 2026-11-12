import type { MotionVersion } from '../../../lab/lib/types.js';
import { CELLS, COLUMNS, LAYOUTS, STATE_ORDER, sizeOf } from '../layouts.js';
import { pictureStates } from '../pictures.js';

// v1: the page's bento, reduced to its core. Three columns, each a stack of colour cards and pictures, the page's arrangement first (a card on top, at the
// bottom, on top). The cells trade height, so a cell that grows pushes the ones next to it and they collapse, and a card or picture that is new comes in from the
// top or the bottom of its column. The shuffle button goes to the next arrangement on each click, and so does a timer (the ring on the button) every five seconds, back to the first after the last. The first cards
// come in with the card entrance preset and every card responds to the pointer with the card preset (hover tint, press scale). Each cell crops its picture.
const MOVE = { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-standard' };
// The intro: the three colour cards alone ('cards': no pictures yet), then the pictures open (the first move, to the first arrangement), the middle one above its
// card, which it pushes down. 'cards' is not part of the shuffle.
const INTRO = 'cards';
const CARDS_ONLY = { y0: 1, i1: 1, g2: 1 };
const ALL = [INTRO, ...STATE_ORDER];
const each = <T>(f: (s: string) => T): Record<string, T> => Object.fromEntries(ALL.map(s => [s, f(s)]));
const layoutOf = (s: string) => (s === INTRO ? CARDS_ONLY : LAYOUTS[s]!);
// the columns open one after another, each a beat after the one before (into the first arrangement). Every cell of a column takes the column's delay, not just
// its picture, so a column's cells stay in step with each other (a picture that waited while its neighbour already collapsed would make the card between
// them jump) and the same holds when the shuffle comes back round to the first arrangement.
const COLUMN_DELAY = ['', 'delay.40', 'delay.70'];
const delayOf = (id: string): string => COLUMN_DELAY[COLUMNS.findIndex(c => c.includes(id))]!;

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const id of CELLS) {
  layers[id] = { states: each(s => sizeOf(layoutOf(s), id)), transitions: each(s => (s === 'default' && delayOf(id) ? { ...MOVE, delay: delayOf(id) } : MOVE)) };
}
// the pictures: each arrangement shows its own (pictures.ts), so the pictures change each time the bento does
for (const [name, states] of Object.entries(pictureStates(ALL))) layers[name] = { states, transitions: each(() => MOVE) };

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Shuffle',
  // the grid fades in quickly and the three colour cards rise in with the card preset, then the pictures open (the interaction's first move)
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: { y0: { preset: 'card' }, i1: { preset: 'card', delay: 'delay.70' }, g2: { preset: 'card', delay: 'delay.120' } },
  interaction: {
    initial: INTRO,
    hold: 'duration.300', // the cards are seen for a quick beat before the pictures open
    states: each(() => ({})),
    transitions: each(() => MOVE),
    layers,
    triggers: [
      // the pagination arrows under the bento: next goes to the next arrangement, previous to the one before (the same list the other way round)
      { on: 'click', toggle: STATE_ORDER as [string, string, ...string[]], target: 'next' },
      { on: 'click', toggle: [...STATE_ORDER].reverse() as [string, string, ...string[]], target: 'prev' },
      { on: 'click', toggle: STATE_ORDER as [string, string, ...string[]], target: 'shuffle' },
      // and by itself: five seconds after the last change (the ring on the button fills over the same five seconds: keep them equal)
      { on: 'interval', every: '5000ms', toggle: STATE_ORDER as [string, string, ...string[]] },
    ],
  },
  elements: { shuffle: 'button', y0: 'card', i0: 'card', g1: 'card', i1: 'card', g2: 'card', y2: 'card' },
  lineage: 'new, from the Figma "9 cell grid" frames (page home, xl · open)',
};

export default v1;
