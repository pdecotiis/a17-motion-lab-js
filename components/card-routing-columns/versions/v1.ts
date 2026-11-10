import type { MotionVersion } from '../../../lab/lib/types.js';

// Three colour cards cascade in with the card entrance preset, rest for a quick beat (300ms), and then the pictures open: each column's picture grows in
// (from no height to 469px) over 300ms, one after another, 40ms apart. In the first and third columns the picture opens below its card; in the middle column it
// opens above, so that card is pushed down to the bottom of its column as the picture grows. The cards use the card preset for hover and press.
// States: cards (the three cards alone: the Figma design's first example) and open (the second). Replay plays it again; the state buttons move between them.
type State = 'cards' | 'open';
const STATES: State[] = ['cards', 'open'];
const GROW = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const each = <T>(f: (s: State) => T): Record<string, T> => Object.fromEntries(STATES.map(s => [s, f(s)]));
const COLUMNS = ['col-1', 'col-2', 'col-3'];
const IMAGES: [string, string | undefined][] = [['image-1', undefined], ['image-2', 'delay.40'], ['image-3', 'delay.70']];

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
// the gap between a column's cells only exists once its picture does
for (const col of COLUMNS) layers[col] = { states: each(s => ({ rowGap: s === 'open' ? '8px' : '0px' })), transitions: each(() => GROW) };
// the pictures: no height and clear, then their full height
for (const [image, delay] of IMAGES) {
  const timing = { ...GROW, ...(delay ? { delay } : {}) };
  layers[image] = { states: each(s => ({ height: s === 'open' ? '469.333px' : '0px', opacity: s === 'open' ? 1 : 0 })), transitions: { cards: GROW, open: timing } };
}

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Cards, then pictures open',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    'card-1': { preset: 'card' },
    'card-2': { preset: 'card', delay: 'delay.70' },
    'card-3': { preset: 'card', delay: 'delay.120' },
  },
  elements: { 'card-1': 'card', 'card-2': 'card', 'card-3': 'card' },
  interaction: {
    initial: 'cards',
    hold: 'duration.300', // the cards are seen for a quick beat before the pictures open
    states: each(() => ({})),
    transitions: each(() => GROW),
    layers,
  },
  lineage: 'imported from https://www.figma.com/design/HuYFjaWLJq5X1UHQw2z63w/Jane-Street-%E2%80%94-Website-%C2%B7-Design-Implementation-WIP?node-id=23827-78879',
};

export default v1;
