import type { MotionVersion } from '../../../lab/lib/types.js';

// v12 keeps v11's spirit (the three colour cards are there for a beat, then resolve into one topic with its pictures; fast, productive easings; the
// colour is always there) in a different layout: the cards are STACKED, one above the other as wide bars (Technology, Trading, Machine Learning),
// and the chosen one grows downward to show its pictures while the others stay as bars. Titles stay visible on every bar, so the closed ones read as
// a menu. The cards view is three bars of 156 (484 in all); open, the colour card is 2:1 (1072 x 536) with a row of pictures
// (196) under it, and the other two topics are 72-tall bars. The component's slot is turned into a column by its state (flexDirection), so v11 and earlier are
// untouched. Same triggers as v11 (click a bar, or the arrow keys), and the colour bars respond to the pointer by the card preset.
type Tab = 'default' | 'trading' | 'technology';
type State = 'cards' | Tab;
const STATES: State[] = ['cards', 'default', 'trading', 'technology'];
const BENTOS: Tab[] = ['default', 'trading', 'technology'];

const TABS: Record<Tab, { grid: string; tile: string; texts: string[]; small1: string; small2: string; second: string; wide: string; cover: string; photos: string; veil: string }> = {
  default: { grid: 'grid', tile: 'tile-1', texts: ['heading', 'actions'], small1: 'image-1', small2: 'image-2', second: 'tile-2', wide: 'image-3', cover: 'cover-1', photos: 'photo-1', veil: 'veil-1' },
  trading: { grid: 'grid-2', tile: 'tile-3', texts: ['heading-2', 'actions-2'], small1: 'image-4', small2: 'image-5', second: 'tile-4', wide: 'image-6', cover: 'cover-2', photos: 'photo-2', veil: 'veil-2' },
  technology: { grid: 'grid-3', tile: 'tile-5', texts: ['heading-3', 'actions-3'], small1: 'image-7', small2: 'image-8', second: 'tile-6', wide: 'image-9', cover: 'cover-3', photos: 'photo-3', veil: 'veil-3' },
};

const WIDTH = '1072px';
// Three bars across the stack's height (484 = 3 × 156 + 2 × 8), a closed bar, and an open topic (324 = 120 + 8 + 196).
const CARDS_GRID = { width: WIDTH, height: '156px', gridTemplateColumns: '1072px 0px 0px 0px', gridTemplateRows: '156px 0px', columnGap: '0px' };
const CLOSED = { width: WIDTH, height: '72px', gridTemplateColumns: '1072px 0px 0px 0px', gridTemplateRows: '72px 0px', columnGap: '0px' };
// Three pictures across (352 each) under a full-width title row (the title card is set to the stack's width, over the columns beside it).
const THIRDS = { width: WIDTH, height: '740px', gridTemplateColumns: '352px 352px 172px 172px', gridTemplateRows: '536px 196px', columnGap: '8px' };
// Machine Learning: its small first picture's column is closed (so the 4px column gap on each side of it makes the 8px gutter) and the cover is the third.
const ML = { width: WIDTH, height: '740px', gridTemplateColumns: '354px 354px 0px 352px', gridTemplateRows: '536px 196px', columnGap: '4px' };
const LAYOUTS: Record<Tab, { grid: Record<string, string>; small1?: Record<string, string>; small2?: Record<string, string>; second?: Record<string, string>; wide?: Record<string, string> }> = {
  default: { grid: ML, second: { marginLeft: '4px' } },
  trading: { grid: THIRDS },
  technology: { grid: THIRDS },
};

const NONE = { marginLeft: '0px', marginRight: '0px' };
// The cell that would sit beside the title card in the top row is hidden (the card runs across it): the cover card of Trading and Technology, and Machine Learning's second picture.
const HIDDEN: Record<Tab, 'second' | 'small2'> = { default: 'small2', trading: 'second', technology: 'second' };
// A bar is a row: the title at the left, the arrow at the right, the same shape closed and open (so only its size changes).
// A bar is as wide as the stack in every state (the title card spans two columns of the open grid, so its width is set rather than left to the tracks).
const BAR = { width: WIDTH, borderRadius: '24px', paddingLeft: '24px', paddingRight: '24px', flexDirection: 'row', alignItems: 'flex-start' };
// The title is top-aligned and the arrow sits at the bottom right, in every state (the open card is 2:1, 1072 x 536; a closed bar's padding is 18 so the 36px title fills its 72).
const padding = (roomy: boolean) => ({ paddingTop: roomy ? '24px' : '18px', paddingBottom: roomy ? '24px' : '18px' });
const OWN_COLOR: Record<Tab, string> = { default: 'var(--background-accent-primary)', trading: 'var(--background-accent-1)', technology: 'var(--background-accent-2)' };

const into = () => ({ model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' });
// The pictures settle from the largest scale (106%) as their topic opens, and dim behind a veil as it closes, after the collapse (as v11).
const ZOOM = '{scale.106}';
const settle = (opens: Tab) => Object.fromEntries(STATES.map(s => [s, s === opens
  ? { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-entrance' }
  : { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-exit', delay: 'duration.300' }]));
const veilTo = () => Object.fromEntries(STATES.map(s => [s, into()]));

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {
  // The three topics stack: the slot is a column in every state.
  slot: { states: Object.fromEntries(STATES.map(s => [s, { flexDirection: 'column' }])) },
};
for (const open of BENTOS) {
  const t = TABS[open];
  const layout = LAYOUTS[open];
  layers[t.grid] = { states: Object.fromEntries(STATES.map(s => [s, s === open ? layout.grid : s === 'cards' ? CARDS_GRID : CLOSED])) };
  layers[t.tile] = { states: Object.fromEntries(STATES.map(s => [s, { ...BAR, ...padding(s === open || s === 'cards'), backgroundColor: OWN_COLOR[open] }])) };
  // The titles stay on every bar (the stylesheet hides a tab's text until a version shows it).
  // The arrow sits at the bottom right.
  for (const text of t.texts) layers[text] = { states: Object.fromEntries(STATES.map(s => [s, { opacity: 1, ...(text.startsWith('actions') ? { justifyContent: 'flex-end', alignSelf: 'flex-end' } : {}) }])) };
  for (const cell of ['small1', 'small2', 'second', 'wide'] as const) {
    layers[t[cell]] = { states: Object.fromEntries(STATES.map(s => [s, { ...(s === open ? { ...NONE, ...layout[cell] } : NONE), ...(HIDDEN[open] === cell ? { opacity: 0 } : {}) }])) };
  }
  layers[t.cover] = { states: Object.fromEntries(STATES.map(s => [s, { opacity: 1, scale: s === open ? 1 : ZOOM }])), transitions: settle(open) };
  layers[t.photos] = { states: Object.fromEntries(STATES.map(s => [s, { scale: s === open ? 1 : ZOOM }])), transitions: settle(open) };
  layers[t.veil] = { states: Object.fromEntries(STATES.map(s => [s, { opacity: s === open ? 0 : 0.4 }])), transitions: veilTo() };
}

// The cards rise in one after the other, top to bottom (green, yellow, orange: 0, 70, 120ms), as in v11.
const cardsEnter = {
  'tile-5': { preset: 'card' },
  'tile-3': { preset: 'card', delay: 'delay.70' },
  'tile-1': { preset: 'card', delay: 'delay.120' },
};

export const v12: MotionVersion = {
  id: 'v12',
  label: 'Stacked cards, expand down',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: cardsEnter,
  elements: { 'tile-5': 'card', 'tile-3': 'card', 'tile-1': 'card' },
  interaction: {
    initial: 'cards',
    hold: '150ms',
    states: Object.fromEntries(STATES.map(s => [s, {}])),
    transitions: Object.fromEntries(STATES.map(s => [s, into()])),
    layers,
    triggers: [
      { on: 'click', set: 'default', target: 'tile-1' },
      { on: 'click', set: 'trading', target: 'tile-3' },
      { on: 'click', set: 'technology', target: 'tile-5' },
      // The arrow keys move down the stack: Technology, Trading, Machine Learning.
      { on: 'arrows', states: ['technology', 'trading', 'default'] },
    ],
  },
  forkedFrom: 'v11',
};

export default v12;
