import type { MotionVersion } from '../../../lab/lib/types.js';
import { CELLS, COLUMNS, isColour, sizeOf } from '../layouts.js';
import { PAIR_LAYOUTS, PAIR_ORDER } from '../layouts-pairs.js';
import { PAIR_PICTURE_OF, pictureStates } from '../pictures.js';

// v4: v1's opening and controls, with arrangements that are always the same shape: every column is a small cell (a colour card) and a big (two rows) picture, and the next
// arrangement is the opposite of the one before, column for column (see layouts-pairs.ts). The colour cards go round: each time the bento changes every card is presented
// one column to the right (there are four colours, orange the primary accent, yellow, green and indigo, so it is the first arrangement again after four). The pictures change
// each time. The shuffle button, the arrows and the timer step through them.
// the fade of a card's title and arrow is about twice as fast as the height change (400ms): the nearest duration token to 200ms
const FADE = { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-standard' };
const MOVE = { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-standard' };
// The intro: the three colour cards alone ('cards': no pictures yet), then the pictures open (the first move, to the first arrangement), the middle one above its
// card, which it pushes down. 'cards' is not part of the shuffle.
const INTRO = 'cards-only';
const CARDS_ONLY = { o0: 1, y1: 1, g2: 1 };
const ALL = [INTRO, ...PAIR_ORDER];
const each = <T>(f: (s: string) => T): Record<string, T> => Object.fromEntries(ALL.map(s => [s, f(s)]));
const layoutOf = (s: string) => (s === INTRO ? CARDS_ONLY : PAIR_LAYOUTS[s]!);
// the columns open one after another, each a beat after the one before (into the first arrangement). Every cell of a column takes the column's delay, not just
// its picture, so a column's cells stay in step with each other (a picture that waited while its neighbour already collapsed would make the card between
// them jump) and the same holds when the shuffle comes back round to the first arrangement.
const COLUMN_DELAY = ['', 'delay.40', 'delay.70'];
const delayOf = (id: string): string => COLUMN_DELAY[COLUMNS.findIndex(c => c.includes(id))]!;

// A cell's box is its visible part plus the 8px gutter below it (the stylesheet clips the gutter off for these states, see "gutter" in styles.css). So the gap between two cells is
// 8px all through a move: a cell that grows from nothing grows its gutter first and only then shows, instead of appearing flush against the card above or below it.
// Both ends of the height are calc() so the CSS and Motion runtimes interpolate them the same way.
const gutterSizeOf = (layout: Parameters<typeof sizeOf>[0], id: string) => {
  const { height } = sizeOf(layout, id);
  return { height: height === '0%' ? 'calc(0% + 0px)' : `calc(${height} + 8px)`, marginTop: '0px', marginBottom: '0px' };
};

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const id of CELLS) {
  layers[id] = { states: each(s => gutterSizeOf(layoutOf(s), id)), transitions: each(s => (s === PAIR_ORDER[0] && delayOf(id) ? { ...MOVE, delay: delayOf(id) } : MOVE)) };
}
// a colour card's title and arrow fade out as it collapses and in as it appears (a card is shown where its height is more than nothing)
for (const id of CELLS.filter(isColour)) {
  const shown = each(s => ({ opacity: sizeOf(layoutOf(s), id).height === '0%' ? 0 : 1 }));
  layers[`title-${id}`] = { states: shown, transitions: each(() => FADE) };
  layers[`arrow-${id}`] = { states: shown, transitions: each(() => FADE) };
}
// the pictures: each arrangement shows its own (pictures.ts), so the pictures change each time the bento does
for (const [name, states] of Object.entries(pictureStates(ALL, PAIR_PICTURE_OF, PAIR_ORDER[0]))) layers[name] = { states, transitions: each(() => MOVE) };

export const v4: MotionVersion = {
  id: 'v4',
  label: 'Shuffle: the cards go round, one column to the right each time',
  // the grid fades in quickly and the three colour cards rise in with the card preset, then the pictures open (the interaction's first move)
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: { o0: { preset: 'card' }, y1: { preset: 'card', delay: 'delay.70' }, g2: { preset: 'card', delay: 'delay.120' } },
  interaction: {
    initial: INTRO,
    hold: 'duration.300', // the cards are seen for a quick beat before the pictures open
    states: each(() => ({})),
    transitions: each(() => MOVE),
    layers,
    triggers: [
      // the pagination arrows under the bento: next goes to the next arrangement, previous to the one before (the same list the other way round)
      { on: 'click', toggle: PAIR_ORDER as [string, string, ...string[]], target: 'next' },
      { on: 'click', toggle: [...PAIR_ORDER].reverse() as [string, string, ...string[]], target: 'prev' },
      { on: 'click', toggle: PAIR_ORDER as [string, string, ...string[]], target: 'shuffle' },
      // and by itself: five seconds after the last change (the ring on the button fills over the same five seconds: keep them equal)
      { on: 'interval', every: '5000ms', toggle: PAIR_ORDER as [string, string, ...string[]] },
    ],
  },
  elements: { shuffle: 'button', ...Object.fromEntries(['o0', 'g0', 'y0', 'y0b', 'i0', 'o1', 'g1', 'y1', 'i1', 'o2', 'g2', 'i2', 'y2'].map(id => [id, 'card'])) },
  forkedFrom: 'v1',
};

export default v4;
