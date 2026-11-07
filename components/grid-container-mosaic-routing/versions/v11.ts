import type { MotionVersion } from '../../../lab/lib/types.js';

// v9 is v7 (two columns of squares, the images and text as in v7) with the closed bars in the secondary background: a closed bento's card is the
// background-secondary colour and takes its own colour (orange, yellow, green) as it expands, on the same timing as its width, so the colour and
// the growing card move together, and it goes back to the bar colour as it closes. The colours are CSS variables from the Figma file's
// colour tokens. The rest is v7:
// v7 is v5 with a two-column grid: each bento is only the text card and an image, side by side, 484 x 600 each (the rest of the grid
// closes). Same timings as v5. The card's text slides in from the left, the side the card
// grows from, the images come in from a larger scale, and they fade to black as a bento closes. Experiment: as v6.
// v11 is fast: everything is on productive easings, the cells morph over 300ms (v10: 800), the text fades in over 220ms after 40ms and
// out over 100ms, the photos settle over 300ms, the scale reset waits for the collapse, the colour cards are held for 150ms before the
// morph (v10: a second), and the cards enter with the preset's stagger (the second at 70ms, the third at 120ms).
// v11 is v10 with the colour always there: the closed bars are never the secondary background, they keep their own colours (so nothing
// animates to colour on hover or click, and the cards only change shape as they open and close). The rest is v10.
// v10 is v9 with a starting view: the three colour cards side by side (green Technology, yellow Trading, orange Machine Learning), each
// with its text. It plays once when the version opens (and on Replay): the scene morphs to the v9 resting layout, Machine Learning open
// with its image, the other two cards narrowing to secondary-coloured bars and their text sliding away. The first state is "cards",
// then the three tabs of v9, which stay live afterwards (click, arrow keys, hover colour). The cards are held for a second first.
type Tab = 'default' | 'trading' | 'technology';
type State = 'cards' | Tab;
const STATES: State[] = ['cards', 'default', 'trading', 'technology'];
const BENTOS: Tab[] = ['default', 'trading', 'technology'];
// Three equal cards across the row: (1072 - 2 gaps of 8) / 3 = 352 wide, and as tall as a bento (484).
const CARDS_GRID = { width: '352px', height: '484px', gridTemplateColumns: '352px 0px 0px 0px', gridTemplateRows: '484px 0px', columnGap: '0px' };
// Each bento: its grid, its text card (with the text layers), and the cells a layout moves.
const TABS: Record<Tab, { grid: string; tile: string; texts: string[]; small1: string; small2: string; second: string; wide: string; cover: string; photos: string; veil: string }> = {
  default: { grid: 'grid', tile: 'tile-1', texts: ['heading', 'actions'], small1: 'image-1', small2: 'image-2', second: 'tile-2', wide: 'image-3', cover: 'cover-1', photos: 'photo-1', veil: 'veil-1' },
  trading: { grid: 'grid-2', tile: 'tile-3', texts: ['heading-2', 'actions-2'], small1: 'image-4', small2: 'image-5', second: 'tile-4', wide: 'image-6', cover: 'cover-2', photos: 'photo-2', veil: 'veil-2' },
  technology: { grid: 'grid-3', tile: 'tile-5', texts: ['heading-3', 'actions-3'], small1: 'image-7', small2: 'image-8', second: 'tile-6', wide: 'image-9', cover: 'cover-3', photos: 'photo-3', veil: 'veil-3' },
};

// The cards are squares: one row 484px tall, as wide as each half (484px), so the bento is 976 x 484 and a closed bar is 484 tall.
const CLOSED = { width: '40px', height: '484px', gridTemplateColumns: '40px 0px 0px 0px', gridTemplateRows: '484px 0px', columnGap: '0px' };
// Only the side padding animates (the top and bottom stay 24px), so the text never drops in from the top.
const CARD = { borderRadius: '24px', paddingLeft: '24px', paddingRight: '24px' };
// A card's own colour. A closed bento's bar keeps it (v11): the colour is always there, so there is no colour change and no hover reveal.
const OWN_COLOR: Record<Tab, string> = { default: 'var(--background-accent-primary)', trading: 'var(--background-accent-1)', technology: 'var(--background-accent-2)' };
const BAR = { borderRadius: '12px', paddingLeft: '0px', paddingRight: '0px' };
const NONE = { marginLeft: '0px', marginRight: '0px' };

// The open layout of a bento: its tracks and the margins that keep every gutter at 8px where a column is closed (the column gap
// shrinks 8 -> 4px, so the cells beside the closed column give back the difference). The same recipes as v2's half-left.
// Two columns of squares, 484 x 484: the text card and an image. The rest closes (the second row to nothing, the small photos' column, and
// for Machine Learning the second photo fills the right half); in Trading and Technology the second colour card is the image.
type Layout = { grid: Record<string, string>; small1?: Record<string, string>; small2?: Record<string, string>; second?: Record<string, string>; wide?: Record<string, string> };
const HALVES = { width: '976px', height: '484px', gridTemplateColumns: '238px 238px 238px 238px', gridTemplateRows: '484px 0px', columnGap: '8px' };
const LAYOUTS: Record<Tab, Layout> = {
  default: { grid: { width: '976px', height: '484px', gridTemplateColumns: '240px 240px 0px 484px', gridTemplateRows: '484px 0px', columnGap: '4px' }, small1: { marginLeft: '4px', marginRight: '4px' }, second: { marginLeft: '4px' } },
  trading: { grid: HALVES },
  technology: { grid: HALVES },
};

const into = (state: State) => ({ model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' });
// Text: fades in a beat after the card starts to open, and out quickly as it closes.
const fadeInto = (opens: Tab) => Object.fromEntries(STATES.map(s => [s, s === opens
  ? { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-entrance', delay: 'delay.40' }
  : { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-exit' }]));

// The images come in from a slightly larger scale (the largest scale token, 106%) and settle to 100% as their bento opens; they do not
// scale on the way out. A black veil dims them: it fades up to 40% over the picture as the bento closes (a soft fade, not to black) and
// off as it opens. The photo's scale resets to 106% only after the cell has finished collapsing (the collapse takes 400ms), when it is
// too narrow to show it, so no scaling is seen on the way out.
const ZOOM = '{scale.106}';
const settle = (opens: Tab) => Object.fromEntries(STATES.map(s => [s, s === opens
  ? { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-entrance' }
  : { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-exit', delay: 'duration.300' }]));
// The veil moves with the cell: exactly the card width's timing, in both directions (800ms, expressive-standard), so the two feel connected.
const veilTo = (_opens: Tab) => Object.fromEntries(STATES.map(s => [s, into(s)]));

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const open of BENTOS) {
  const t = TABS[open];
  const layout = LAYOUTS[open];
  layers[t.grid] = { states: Object.fromEntries(STATES.map(s => [s, s === open ? layout.grid : s === 'cards' ? CARDS_GRID : CLOSED])) };
  layers[t.tile] = { states: Object.fromEntries(STATES.map(s => [s, s === open || s === 'cards' ? { ...CARD, backgroundColor: OWN_COLOR[open] } : { ...BAR, backgroundColor: OWN_COLOR[open] }])) };
  // The text comes in from the side the card grows out from (the left: the bar's edge stays put and the card widens to the right),
  // not down from the top: it slides in 24px as it fades in, and back out the same way.
  for (const text of t.texts) layers[text] = { states: Object.fromEntries(STATES.map(s => [s, s === open || s === 'cards' ? { opacity: 1, transform: 'none' } : { opacity: 0, transform: 'translateX(-{distance.24})' }])), transitions: fadeInto(open) };
  for (const cell of ['small1', 'small2', 'second', 'wide'] as const) {
    layers[t[cell]] = { states: Object.fromEntries(STATES.map(s => [s, s === open ? { ...NONE, ...layout[cell] } : NONE])) };
  }
  // the second card is an image in every state; photos and cover scale in, the veil hides them
  layers[t.cover] = { states: Object.fromEntries(STATES.map(s => [s, { opacity: 1, scale: s === open ? 1 : ZOOM }])), transitions: settle(open) };
  layers[t.photos] = { states: Object.fromEntries(STATES.map(s => [s, { scale: s === open ? 1 : ZOOM }])), transitions: settle(open) };
  layers[t.veil] = { states: Object.fromEntries(STATES.map(s => [s, { opacity: s === open ? 0 : 0.4 }])), transitions: veilTo(open) };
}

// How the cards appear on the page: the card entrance preset (a slight rise, scale and fade, read from the Figma presets frame), each of
// the three cards one after the other (green, yellow, orange: 0, 70, 120ms). The root only fades in, quickly, so the cards are the motion.
// The entrance ends on the cards view, which is held for a second before the scene morphs to Machine Learning open.
const cardsEnter = {
  'tile-5': { preset: 'card' },
  'tile-3': { preset: 'card', delay: 'delay.70' },
  'tile-1': { preset: 'card', delay: 'delay.120' },
};

export const v11: MotionVersion = {
  id: 'v11',
  label: 'Tabs: colour always',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: cardsEnter,
  interaction: {
    initial: 'cards',
    hold: '150ms', // the colour cards are held for a short beat before the scene morphs
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
  forkedFrom: 'v10',
};

export default v11;
