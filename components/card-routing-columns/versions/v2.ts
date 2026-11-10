import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v1's sequence (the cards cascade in, a quick beat, the pictures are masked in by their containers) with square pictures: each opens to 352 x 352 instead
// of 352 x 469, so a column is 595 tall (a 235 card, 8px, a 352 picture). The picture is set to the square too, so the container still only uncovers it
// (nothing scales). The cards, their entrance, the card preset on them and the timings are v1's.
type State = 'cards' | 'open';
const STATES: State[] = ['cards', 'open'];
const SQUARE = '352px';
const GROW = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const each = <T>(f: (s: State) => T): Record<string, T> => Object.fromEntries(STATES.map(s => [s, f(s)]));

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const col of ['col-1', 'col-2', 'col-3']) layers[col] = { states: each(s => ({ rowGap: s === 'open' ? '8px' : '0px' })), transitions: each(() => GROW) };
([['image-1', 'photo-1', undefined], ['image-2', 'photo-2', 'delay.40'], ['image-3', 'photo-3', 'delay.70']] as const).forEach(([image, photo, delay]) => {
  const timing = { ...GROW, ...(delay ? { delay } : {}) };
  layers[image] = { states: each(s => ({ height: s === 'open' ? SQUARE : '0px' })), transitions: { cards: GROW, open: timing } };
  // the picture is the square in both states, so it never changes size while its container opens
  layers[photo] = { states: each(() => ({ height: SQUARE })) };
});

export const v2: MotionVersion = {
  ...v1,
  id: 'v2',
  label: 'Square pictures',
  interaction: { ...v1.interaction!, layers },
  forkedFrom: 'v1',
};
delete (v2 as { lineage?: string }).lineage;

export default v2;
