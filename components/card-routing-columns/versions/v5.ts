import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v5: the default is three columns, each a colour card with its picture (as v2 opens). Click a picture and the bento animates to ONE card with ONE
// picture, "2 up", in the order of the links: Machine Learning, then Trading, then Technology. The column in turn takes the full width (1072: the card
// across the top, the picture as a wide banner under it) and the other two close up beside it. Clicking the picture cycles to the next; after Technology
// the next click goes back to the three-column default. The bento is the same height (595: a 235 card, 8, a 352 picture) in every arrangement. A card
// also brings back the default. It opens as v2 does: the cards cascade in, a quick beat, the pictures are masked in.
// States: cards (just the cards), default (3 x 2), ml, trading, tech (the one that is showing).
type State = 'cards' | 'default' | 'ml' | 'trading' | 'tech';
const STATES: State[] = ['cards', 'default', 'ml', 'trading', 'tech'];
const GROW = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const each = <T>(f: (s: State) => T): Record<string, T> => Object.fromEntries(STATES.map(s => [s, f(s)]));

const COLUMNS: Record<State, string> = {
  cards: '352px 352px 352px', default: '352px 352px 352px',
  ml: '1072px 0px 0px', trading: '0px 1072px 0px', tech: '0px 0px 1072px',
};
const SHOWING: Record<string, State> = { 'col-1': 'ml', 'col-2': 'trading', 'col-3': 'tech' };
const imageHeight = (s: State): string => (s === 'cards' ? '0px' : '352px');

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {
  // no gaps between the tracks when one column has the whole width
  grid: { states: each(s => ({ gridTemplateColumns: COLUMNS[s], columnGap: s === 'ml' || s === 'trading' || s === 'tech' ? '0px' : '8px' })), transitions: each(() => GROW) },
};
for (const col of ['col-1', 'col-2', 'col-3']) {
  // a column that is closed up fades with it and takes no clicks
  layers[col] = {
    states: each(s => {
      const twoUp = s === 'ml' || s === 'trading' || s === 'tech';
      const gone = twoUp && SHOWING[col] !== s;
      return { rowGap: s === 'cards' ? '0px' : '8px', opacity: gone ? 0 : 1, pointerEvents: gone ? 'none' : 'auto' };
    }),
    transitions: each(() => GROW),
  };
}
([['image-1', 'photo-1', undefined], ['image-2', 'photo-2', 'delay.40'], ['image-3', 'photo-3', 'delay.70']] as const).forEach(([image, photo, delay]) => {
  layers[image] = { states: each(s => ({ height: imageHeight(s) })), transitions: each(s => (s === 'default' && delay ? { ...GROW, delay } : GROW)) };
  layers[photo] = { states: each(() => ({ height: '100%' })) };
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
