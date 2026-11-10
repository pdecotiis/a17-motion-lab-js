import type { MotionVersion } from '../../../lab/lib/types.js';

// v13: tabs above a bento (Figma "xl · open"), a different layout from the stacked and side-by-side bentos of v1 to v12. A pill of three tabs
// (Machine Learning, Trading, Technology) over ONE bento: a big picture, a small picture and a colour card. Clicking a tab (or the arrow keys)
// changes the bento: the cells MORPH between three layouts (the grid's tracks move over 300ms productive-standard, the same move as the other versions),
// the pictures crossfade in each cell, and the colour card changes colour and title. The selected tab's pill fills with the page colour. The tabs
// respond to the pointer by the button preset.
// It uses its own block of markup (the layers named t-…): every state of this version opens that block and closes the three bentos (width and height
// to nothing) and turns the slot into a column, so the other versions, which never open it, are untouched.
// Layouts (8px apart, 1072 x 536): Machine Learning 712 | 352 (the Figma design), Trading 352 | 712, Technology 532 | 532 with no small picture (its row
// closes and the green card fills the height: two cards). In the others the big picture runs the full height, the small picture and the card each
// take half of the right column.
type Tab = 'ml' | 'trading' | 'technology';
const TABS: Tab[] = ['ml', 'trading', 'technology'];
// Two rows of 264 (8px apart); Technology closes the top row and gives the card the whole height (the gap closes too), so it is just two cards.
const ROWS: Record<Tab, string> = { ml: '264px 264px', trading: '264px 264px', technology: '0px 536px' };
const ROW_GAP: Record<Tab, string> = { ml: '8px', trading: '8px', technology: '0px' };
const COLUMNS: Record<Tab, string> = { ml: '712px 352px', trading: '352px 712px', technology: '532px 532px' };
const COLOR: Record<Tab, string> = { ml: 'var(--background-accent-primary)', trading: 'var(--background-accent-1)', technology: 'var(--background-accent-2)' };
const TITLE_COLOR: Record<Tab, string> = { ml: 'var(--text-on-accent-primary)', trading: 'var(--text-on-accent-1)', technology: 'var(--text-on-accent-2)' };

const MORPH = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const FADE = { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-entrance' };
const each = <T>(f: (s: Tab) => T): Record<string, T> => Object.fromEntries(TABS.map(s => [s, f(s)]));
const timing = (t: typeof MORPH | typeof FADE) => each(() => t);

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {
  // Open this version's block, close the three bentos, and stack the slot: the same in every state, so none of it animates.
  slot: { states: each(() => ({ flexDirection: 'column', gap: '0px' })) },
  't-block': { states: each(() => ({ width: '1072px', height: '608px', marginTop: '16px', opacity: 1 })) },
  grid: { states: each(() => ({ width: '0px', height: '0px' })) },
  'grid-2': { states: each(() => ({ width: '0px', height: '0px' })) },
  'grid-3': { states: each(() => ({ width: '0px', height: '0px' })) },
  // The cells morph: the grid's tracks move to the next layout.
  't-bento': { states: each(s => ({ gridTemplateColumns: COLUMNS[s], gridTemplateRows: ROWS[s], rowGap: ROW_GAP[s] })), transitions: timing(MORPH) },
  't-card': { states: each(s => ({ backgroundColor: COLOR[s] })), transitions: timing(MORPH) },
  // The arrow (a dark SVG) is light on the green card, as the title is.
  't-arrow': { states: each(s => ({ filter: s === 'technology' ? 'brightness(0) invert(0.96)' : 'brightness(0) invert(0.08)' })), transitions: timing(MORPH) },
};
for (const tab of TABS) {
  // Pictures: stacked in their cell, one shown.
  for (const part of ['big', 'small']) layers[`t-${part}-${tab}`] = { states: each(s => ({ opacity: s === tab ? 1 : 0 })), transitions: timing(FADE) };
  // Titles: stacked, one shown, in the card's text colour (dark on orange and yellow, light on green).
  layers[`t-title-${tab}`] = { states: each(s => ({ opacity: s === tab ? 1 : 0, color: TITLE_COLOR[tab] })), transitions: timing(FADE) };
  // The selected tab's pill is the page colour; the others are clear.
  layers[`t-tab-${tab}`] = { states: each(s => ({ backgroundColor: s === tab ? 'rgba(245, 244, 242, 1)' : 'rgba(245, 244, 242, 0)' })), transitions: timing(FADE) };
}

export const v13: MotionVersion = {
  id: 'v13',
  label: 'Tabs, cells morph',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  // The tabs come in as a button, then the three cells one after the other as cards.
  layers: {
    't-tabs': { preset: 'button' },
    't-big': { preset: 'card' },
    't-small': { preset: 'card', delay: 'delay.70' },
    't-card': { preset: 'card', delay: 'delay.120' },
  },
  // The tabs respond to the pointer by the button preset, and the colour card by the card preset (a tint on hover, a slight scale on press, released a little slower).
  elements: { 't-tab-ml': 'button', 't-tab-trading': 'button', 't-tab-technology': 'button', 't-card': 'card' },
  interaction: {
    initial: 'ml',
    states: each(() => ({})),
    transitions: each(() => MORPH),
    layers,
    triggers: [
      { on: 'click', set: 'ml', target: 't-tab-ml' },
      { on: 'click', set: 'trading', target: 't-tab-trading' },
      { on: 'click', set: 'technology', target: 't-tab-technology' },
      { on: 'arrows', states: ['ml', 'trading', 'technology'] },
    ],
  },
  forkedFrom: 'v12',
};

export default v13;
