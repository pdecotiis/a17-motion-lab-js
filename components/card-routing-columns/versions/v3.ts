import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v3: click a picture and the bento rearranges around it. It starts as v2 does (the three colour cards cascade in, a quick beat, the pictures are masked
// in, as squares), and then the columns trade width: click a picture and its column widens (600 against 228 + 228) while the other two narrow; the pictures stay 352 tall,
// so the bento is the same height (595) in every arrangement: the three squares become one wide picture and two slim ones. Every colour card stays in every
// arrangement: a narrow card still says its title, and clicking any card brings back the three equal columns.
// States: cards (just the cards), default (three squares), first, second, third (the column that is open).
type State = 'cards' | 'default' | 'first' | 'second' | 'third';
const STATES: State[] = ['cards', 'default', 'first', 'second', 'third'];
const OPEN: State[] = ['first', 'second', 'third'];
const GROW = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const each = <T>(f: (s: State) => T): Record<string, T> => Object.fromEntries(STATES.map(s => [s, f(s)]));

// Columns: 1072 between the gaps. Three of 352, or one of 600 and two of 228.
const COLUMNS: Record<State, string> = {
  cards: '352px 352px 352px', default: '352px 352px 352px',
  first: '600px 228px 228px', second: '228px 600px 228px', third: '228px 228px 600px',
};
// The pictures: closed, or 352 tall in every arrangement, so the bento is the same height (595: a 235 card, 8, a 352 picture) however the columns share the width.
const IMAGE_HEIGHT: Record<State, string> = { cards: '0px', default: '352px', first: '352px', second: '352px', third: '352px' };

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {
  grid: { states: each(s => ({ gridTemplateColumns: COLUMNS[s] })), transitions: each(() => GROW) },
};
for (const col of ['col-1', 'col-2', 'col-3']) layers[col] = { states: each(s => ({ rowGap: s === 'cards' ? '0px' : '8px' })), transitions: each(() => GROW) };
([['image-1', 'photo-1', undefined], ['image-2', 'photo-2', 'delay.40'], ['image-3', 'photo-3', 'delay.70']] as const).forEach(([image, photo, delay]) => {
  // coming up from the cards the pictures open one after another; moving between arrangements they all move together
  layers[image] = { states: each(s => ({ height: IMAGE_HEIGHT[s] })), transitions: each(s => (s === 'default' && delay ? { ...GROW, delay } : GROW)) };
  // the picture fills its container (so it follows the arrangement)
  layers[photo] = { states: each(() => ({ height: '100%' })) };
});

export const v3: MotionVersion = {
  ...v1,
  id: 'v3',
  label: 'Click a picture to rearrange',
  interaction: {
    ...v1.interaction!,
    states: each(() => ({})),
    transitions: each(() => GROW),
    layers,
    triggers: [
      { on: 'click', set: 'first', target: 'image-1' },
      { on: 'click', set: 'second', target: 'image-2' },
      { on: 'click', set: 'third', target: 'image-3' },
      // a card brings the three equal columns back
      { on: 'click', set: 'default', target: 'card-1' },
      { on: 'click', set: 'default', target: 'card-2' },
      { on: 'click', set: 'default', target: 'card-3' },
    ],
  },
  forkedFrom: 'v2',
};
delete (v3 as { lineage?: string }).lineage;
void OPEN;

export default v3;
