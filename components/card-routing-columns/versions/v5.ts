import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v5: the default is three columns of a card above its picture (as v2 opens). Click a picture and the bento animates to ONE card with ONE picture, "2 up",
// in the order of the links: Machine Learning, then Trading, then Technology. The pair sits side by side on the three-column grid: the card takes ONE
// grid column (352 wide, the full height) and the picture TWO (712 wide), so each fills whole spaces of the grid, as in the Figma bento; the other two
// columns close up. Clicking the picture cycles to the next; after Technology the next click goes back to the three. The bento is the same height (595) in
// every arrangement. A card also brings back the three. It opens as v2 does: the cards cascade in, a quick beat, the pictures are masked in.
// How a column goes from stacked to side by side without a jump: every column is a row of two items. Stacked, the picture is pushed under the card
// (a top margin) and pulled back to the left edge (a negative left margin); side by side both margins are 0. Nothing but sizes and margins animates.
// States: cards (just the cards), default (3 x 2), ml, trading, tech (the one that is showing).
type State = 'cards' | 'default' | 'ml' | 'trading' | 'tech';
const STATES: State[] = ['cards', 'default', 'ml', 'trading', 'tech'];
const GROW = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const each = <T>(f: (s: State) => T): Record<string, T> => Object.fromEntries(STATES.map(s => [s, f(s)]));

const COLUMNS: Record<State, string> = {
  cards: '352px 352px 352px', default: '352px 352px 352px',
  ml: '1072px 0px 0px', trading: '0px 1072px 0px', tech: '0px 0px 1072px',
};
const SHOWING: Record<number, State> = { 1: 'ml', 2: 'trading', 3: 'tech' };
const twoUp = (s: State): boolean => s === 'ml' || s === 'trading' || s === 'tech';
// the column whose card and picture are showing in this state (none in the other states)
const active = (col: number, s: State): boolean => SHOWING[col] === s;

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {
  // no gaps between the tracks when one column has the whole width
  grid: { states: each(s => ({ gridTemplateColumns: COLUMNS[s], columnGap: twoUp(s) ? '0px' : '8px' })), transitions: each(() => GROW) },
};
([[1, undefined], [2, 'delay.40'], [3, 'delay.70']] as const).forEach(([n, delay]) => {
  // a column is a row of two items (the card, then the picture), whatever it shows
  layers[`col-${n}`] = {
    states: each(s => {
      const gone = twoUp(s) && !active(n, s);       // closed up: fades with its track and takes no clicks
      return { flexDirection: 'row', opacity: gone ? 0 : 1, pointerEvents: gone ? 'none' : 'auto' };
    }),
    transitions: each(() => GROW),
  };
  // the card: one grid column wide and the full height side by side; 352 x 235 stacked
  layers[`card-${n}`] = { states: each(s => ({ width: '352px', height: active(n, s) ? '595px' : '235px' })), transitions: each(() => GROW) };
  // the picture: two grid columns wide (712) side by side; stacked under the card (352 x 352, up to the left edge) otherwise
  layers[`image-${n}`] = {
    states: each(s => active(n, s)
      ? { width: '712px', height: '595px', marginLeft: '0px', marginTop: '0px' }
      : { width: '352px', height: s === 'cards' ? '0px' : '352px', marginLeft: '-360px', marginTop: s === 'cards' ? '0px' : '243px' }),
    transitions: each(s => (s === 'default' && delay ? { ...GROW, delay } : GROW)),
  };
  layers[`photo-${n}`] = { states: each(() => ({ height: '100%' })) };
});

export const v5: MotionVersion = {
  ...v1,
  id: 'v5',
  label: 'Three up, then one at a time',
  interaction: {
    ...v1.interaction!,
    states: each(() => ({})),
    transitions: each(() => GROW),
    layers,
    triggers: [
      // each click on a picture goes to the next of Machine Learning, Trading, Technology, then back to the three
      ...(['image-1', 'image-2', 'image-3'] as const).map(target => ({ on: 'click' as const, toggle: ['ml', 'trading', 'tech', 'default'] as [string, string, ...string[]], target })),
      ...(['card-1', 'card-2', 'card-3'] as const).map(target => ({ on: 'click' as const, set: 'default', target })),
    ],
  },
  forkedFrom: 'v3',
};
delete (v5 as { lineage?: string }).lineage;

export default v5;
