import type { MotionVersion } from '../../../lab/lib/types.js';

// v5 is v4 two steps slower on the scale and with expressive easings throughout: the cells morph over 800ms (v4: 400), the card's text
// fades in over 560ms with an expressive entrance after a 120ms beat (v4: 220 and 70) and out over 220ms (v4: 100).
// Tabs: three bentos in a row, one open at a time, the other two closed to a 40px bar. Orange is Machine Learning (where it
// starts, as in the Figma frame), yellow is Trading, green is Technology. The bar is the first cell of its bento: click it and
// that bento opens around the cell, so the bar widens and shortens into the card (its radius and padding grow, its text fades
// in) while the other cells grow into the grid; the bento that was open closes the same way, its cells collapsing, to a bar.
// The card with the text is always top left; the two small photos sit in a different place in each bento (top right, bottom right,
// bottom left) for variety.
// The photos are masked: each keeps its size and the cell reveals or hides it as it grows or shrinks (see styles.css).
// The open bento is always 976px (four 238px columns, two 296px rows, 8px gaps) and the closed ones 40px, so the row never
// changes width. Click any bar to go there; the orange bar stays on the right to come back to. (Experiment: width, grid
// tracks, gaps, padding and radius in a state; the Trading and Technology bentos are markup added for this test, a Figma
// re-import would replace them.)

type Tab = 'default' | 'trading' | 'technology';
const STATES: Tab[] = ['default', 'trading', 'technology'];
// The bento (grid layer) and its first card (tile layer, with its heading and actions) for each state that opens it.
const TABS: Record<Tab, { grid: string; tile: string; texts: string[] }> = {
  default: { grid: 'grid', tile: 'tile-1', texts: ['heading', 'actions'] },
  trading: { grid: 'grid-2', tile: 'tile-3', texts: ['heading-2', 'actions-2'] },
  technology: { grid: 'grid-3', tile: 'tile-5', texts: ['heading-3', 'actions-3'] },
};

const OPEN = { width: '976px', gridTemplateColumns: '238px 238px 238px 238px', gridTemplateRows: '296px 296px', columnGap: '8px' };
const CLOSED = { width: '40px', gridTemplateColumns: '40px 0px 0px 0px', gridTemplateRows: '600px 0px', columnGap: '0px' };
// Only the side padding animates (the top and bottom stay 24px), so the text never drops in from the top.
const CARD = { borderRadius: '24px', paddingLeft: '24px', paddingRight: '24px' };
const BAR = { borderRadius: '12px', paddingLeft: '0px', paddingRight: '0px' };

const into = (state: Tab) => ({ model: 'tween' as const, duration: 'duration.800', easing: 'easing.expressive-standard' });
// Text: fades in a beat after the card starts to open, and out quickly as it closes.
const fadeInto = (opens: Tab) => Object.fromEntries(STATES.map(s => [s, s === opens
  ? { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'delay.120' }
  : { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-exit' }]));

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const open of STATES) {
  const t = TABS[open];
  layers[t.grid] = { states: Object.fromEntries(STATES.map(s => [s, s === open ? OPEN : CLOSED])) };
  layers[t.tile] = { states: Object.fromEntries(STATES.map(s => [s, s === open ? CARD : BAR])) };
  for (const text of t.texts) layers[text] = { states: Object.fromEntries(STATES.map(s => [s, { opacity: s === open ? 1 : 0 }])), transitions: fadeInto(open) };
}

export const v5: MotionVersion = {
  id: 'v5',
  label: 'Tabs: expressive, slower',
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
  forkedFrom: 'v4',
};

export default v5;
