import type { MotionVersion } from '../../../lab/lib/types.js';

// v6 is v5 with no small cards: each bento is the text card and three big images (the Figma layout's two small photos never show,
// and the second colour card is an image). Same timings as v5 (cells over 800ms, text in over 560ms after 120ms, out over 220ms).
// Experiment: width, grid tracks, gap and margin in a state, as in v4 and v5; the cover photos are markup added for this test.
type Tab = 'default' | 'trading' | 'technology';
const STATES: Tab[] = ['default', 'trading', 'technology'];
// Each bento: its grid, its text card (with the text layers), and the cells a layout moves.
const TABS: Record<Tab, { grid: string; tile: string; texts: string[]; small1: string; small2: string; second: string; wide: string; cover: string }> = {
  default: { grid: 'grid', tile: 'tile-1', texts: ['heading', 'actions'], small1: 'image-1', small2: 'image-2', second: 'tile-2', wide: 'image-3', cover: 'cover-1' },
  trading: { grid: 'grid-2', tile: 'tile-3', texts: ['heading-2', 'actions-2'], small1: 'image-4', small2: 'image-5', second: 'tile-4', wide: 'image-6', cover: 'cover-2' },
  technology: { grid: 'grid-3', tile: 'tile-5', texts: ['heading-3', 'actions-3'], small1: 'image-7', small2: 'image-8', second: 'tile-6', wide: 'image-9', cover: 'cover-3' },
};

const CLOSED = { width: '40px', gridTemplateColumns: '40px 0px 0px 0px', gridTemplateRows: '600px 0px', columnGap: '0px' };
// Only the side padding animates (the top and bottom stay 24px), so the text never drops in from the top.
const CARD = { borderRadius: '24px', paddingLeft: '24px', paddingRight: '24px' };
const BAR = { borderRadius: '12px', paddingLeft: '0px', paddingRight: '0px' };
const NONE = { marginLeft: '0px', marginRight: '0px' };

// The open layout of a bento: its tracks and the margins that keep every gutter at 8px where a column is closed (the column gap
// shrinks 8 -> 4px, so the cells beside the closed column give back the difference). The same recipes as v2's half-left.
// Four equal cells, 484 x 296: the text card, and three images. The two small photos never show: one closes, the other fills
// its place, and the second colour card is an image (its cover photo).
type Layout = { grid: Record<string, string>; small1?: Record<string, string>; small2?: Record<string, string>; second?: Record<string, string>; wide?: Record<string, string> };
const CLOSE_C3 = { width: '976px', gridTemplateColumns: '240px 240px 0px 484px', gridTemplateRows: '296px 296px', columnGap: '4px' };
const LAYOUTS: Record<Tab, Layout> = {
  default: { grid: CLOSE_C3, small1: { marginLeft: '4px', marginRight: '4px' }, second: { marginLeft: '4px' } },
  trading: { grid: CLOSE_C3, small1: { marginLeft: '4px', marginRight: '4px' }, second: { marginLeft: '4px' } },
  // Technology's small photos are bottom left: the first column closes, the second photo steps back a gap to meet the edge.
  technology: { grid: { width: '976px', gridTemplateColumns: '0px 480px 242px 242px', gridTemplateRows: '296px 296px', columnGap: '4px' }, small2: { marginLeft: '-4px', marginRight: '0px' }, second: { marginLeft: '4px' }, wide: { marginLeft: '4px' } },
};

const into = (state: Tab) => ({ model: 'tween' as const, duration: 'duration.800', easing: 'easing.expressive-standard' });
// Text: fades in a beat after the card starts to open, and out quickly as it closes.
const fadeInto = (opens: Tab) => Object.fromEntries(STATES.map(s => [s, s === opens
  ? { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'delay.120' }
  : { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-exit' }]));

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const open of STATES) {
  const t = TABS[open];
  const layout = LAYOUTS[open];
  layers[t.grid] = { states: Object.fromEntries(STATES.map(s => [s, s === open ? layout.grid : CLOSED])) };
  layers[t.tile] = { states: Object.fromEntries(STATES.map(s => [s, s === open ? CARD : BAR])) };
  for (const text of t.texts) layers[text] = { states: Object.fromEntries(STATES.map(s => [s, { opacity: s === open ? 1 : 0 }])), transitions: fadeInto(open) };
  for (const cell of ['small1', 'small2', 'second', 'wide'] as const) {
    layers[t[cell]] = { states: Object.fromEntries(STATES.map(s => [s, s === open ? { ...NONE, ...layout[cell] } : NONE])) };
  }
  layers[t.cover] = { states: Object.fromEntries(STATES.map(s => [s, { opacity: 1 }])) }; // the second card is an image in every state
}

export const v6: MotionVersion = {
  id: 'v6',
  label: 'Tabs: large cells only',
  interaction: {
    initial: 'default',
    states: Object.fromEntries(STATES.map(s => [s, {}])),
    transitions: Object.fromEntries(STATES.map(s => [s, into(s)])),
    layers,
    triggers: [
      { on: 'click', set: 'default', target: 'tile-1' },
      { on: 'click', set: 'trading', target: 'tile-3' },
      { on: 'click', set: 'technology', target: 'tile-5' },
      // The arrow keys move through the bentos as they sit in the row: green (Technology), yellow (Trading), orange (Machine Learning).
      { on: 'arrows', states: ['technology', 'trading', 'default'] },
    ],
  },
  forkedFrom: 'v5',
};

export default v6;
