import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v5: three columns of a card above its picture, then click a picture for ONE card and ONE picture at a time (Machine Learning, Trading, Technology,
// then back to the three). It MORPHS, as the earlier bentos did: nothing fades. Every cell is a window onto its content (the container is the mask), the
// cards come in by their columns opening, the pictures are uncovered by their containers growing, and a column that is closed up simply runs out of width,
// its cards and picture masked away with it, while the one that grows takes the room: one cell gets larger as the others get smaller.
// The pair is divided evenly, two columns and no rows: the card 532 wide and the picture 532, each the full height (595), 8px apart. The bento is 595 tall
// in every arrangement. Stacked, the picture sits under the card (a top margin) and is pulled back to the left edge (a negative left margin); side by
// side both margins are 0, so only sizes and margins animate. The pictures keep their size inside their containers (the container masks them).
// A column that closes up keeps the size it had (the container masks it away), so from one pair to the next a cell only runs out of width: it never
// gets smaller by width and height at once. A card brings the three back. States: start (everything closed), default (3 x 2), ml, trading, tech (the one showing).
type State = 'start' | 'default' | 'ml' | 'trading' | 'tech';
const STATES: State[] = ['start', 'default', 'ml', 'trading', 'tech'];
const GROW = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const each = <T>(f: (s: State) => T): Record<string, T> => Object.fromEntries(STATES.map(s => [s, f(s)]));

const COLUMNS: Record<State, string> = {
  start: '0px 0px 0px', default: '352px 352px 352px',
  ml: '1072px 0px 0px', trading: '0px 1072px 0px', tech: '0px 0px 1072px',
};
const twoUp = (s: State): boolean => s === 'ml' || s === 'trading' || s === 'tech';

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {
  // the tracks are the morph: no gaps when one column has the whole width, none while everything is closed
  grid: { states: each(s => ({ gridTemplateColumns: COLUMNS[s], columnGap: s === 'default' ? '8px' : '0px' })), transitions: each(() => GROW) },
};
// from the start the cards are in first (their columns open), the pictures follow after a quick beat, one after another
const BEAT = [ 'duration.400', 'duration.560', 'duration.560' ] as const;
([1, 2, 3] as const).forEach((n, k) => {
  // the middle column has its picture above its card (as the design does), the others the card above the picture: in the row of two items the first one
  // sits at the left and the second is pulled back under it when stacked
  const imageFirst = n === 2;
  layers[`col-${n}`] = { states: each(() => ({ flexDirection: 'row', overflow: 'hidden' })), transitions: each(() => GROW) };
  const cardStacked = imageFirst
    ? (s: State) => ({ marginLeft: '-360px', marginTop: s === 'start' ? '0px' : '360px' })   // under the picture, up to the left edge
    : () => ({ marginLeft: '0px', marginTop: '0px' });
  layers[`card-${n}`] = {
    states: each(s => twoUp(s)
      ? { width: '532px', height: '595px', marginLeft: '0px', marginTop: '0px' }
      : { width: '352px', height: '235px', ...cardStacked(s) }),
    transitions: each(() => GROW),
  };
  const imageStacked = imageFirst
    ? (s: State) => ({ width: '352px', height: s === 'start' ? '0px' : '352px', marginLeft: '0px', marginTop: '0px' })
    : (s: State) => ({ width: '352px', height: s === 'start' ? '0px' : '352px', marginLeft: '-360px', marginTop: '243px' });
  layers[`image-${n}`] = {
    states: each(s => twoUp(s) ? { width: '532px', height: '595px', marginLeft: '0px', marginTop: '0px' } : imageStacked(s)),
    transitions: each(s => (s === 'default' ? { ...GROW, delay: BEAT[k]! } : GROW)),
  };
  // the picture keeps its size; its container is the mask
  layers[`photo-${n}`] = { states: each(() => ({ width: '532px', height: '595px' })) };
});

export const v5: MotionVersion = {
  ...v1,
  id: 'v5',
  label: 'Three up, then one at a time',
  // no entrance of its own: the first move, from the closed start to the three, is the entrance (the cells grow in; nothing fades)
  model: undefined as never,
  keyframes: undefined as never,
  layers: undefined as never,
  interaction: {
    ...v1.interaction!,
    initial: 'start',
    hold: undefined as never,
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
delete (v5 as { model?: unknown }).model;
delete (v5 as { keyframes?: unknown }).keyframes;
delete (v5 as { layers?: unknown }).layers;
delete (v5.interaction as { hold?: unknown }).hold;

export default v5;
