import type { MotionVersion } from '../../../lab/lib/types.js';

// Tabs above a bento (Figma "xl · open"). Clicking a tab (or the arrow keys) changes the bento: the cells MORPH between three layouts (the tracks of the
// grid change over 300ms productive-standard, the same move as the mosaic's), the pictures crossfade in each cell, and the colour card changes colour
// and title. The selected tab's pill fills with the page colour. The tabs respond to the pointer by the button preset.
// Layouts (8px apart, 1072 x 536): Machine Learning 712 | 352 (the Figma design), Trading 352 | 712, Technology 532 | 532; the big picture runs the
// full height, the small picture and the card each take half of the right column.
type Tab = 'ml' | 'trading' | 'technology';
const TABS: Tab[] = ['ml', 'trading', 'technology'];
const ROWS = '264px 264px';
const COLUMNS: Record<Tab, string> = { ml: '712px 352px', trading: '352px 712px', technology: '532px 532px' };
const COLOR: Record<Tab, string> = { ml: 'var(--background-accent-primary)', trading: 'var(--background-accent-1)', technology: 'var(--background-accent-2)' };
const TITLE_COLOR: Record<Tab, string> = { ml: 'var(--text-on-accent-primary)', trading: 'var(--text-on-accent-1)', technology: 'var(--text-on-accent-2)' };

const MORPH = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const FADE = { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-entrance' };
const each = <T>(f: (s: Tab) => T): Record<string, T> => Object.fromEntries(TABS.map(s => [s, f(s)]));
const timing = (t: typeof MORPH | typeof FADE) => each(() => t);

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {
  // The cells morph: the grid's tracks move to the next layout.
  bento: { states: each(s => ({ gridTemplateColumns: COLUMNS[s], gridTemplateRows: ROWS })), transitions: timing(MORPH) },
  card: { states: each(s => ({ backgroundColor: COLOR[s] })), transitions: timing(MORPH) },
};
for (const tab of TABS) {
  // Pictures and titles: stacked, one shown.
  for (const part of ['big', 'small', 'title']) layers[`${part}-${tab}`] = { states: each(s => ({ opacity: s === tab ? 1 : 0 })), transitions: timing(FADE) };
  // The selected tab's pill is the page colour; the others are clear.
  layers[`tab-${tab}`] = { states: each(s => ({ backgroundColor: s === tab ? 'rgba(245, 244, 242, 1)' : 'rgba(245, 244, 242, 0)' })), transitions: timing(FADE) };
}
// The arrow (a dark SVG) is light on the green card, as the title is.
layers['arrow'] = { states: each(s => ({ filter: s === 'technology' ? 'brightness(0) invert(0.96)' : 'brightness(0) invert(0.08)' })), transitions: timing(MORPH) };
// The title colour follows the card (dark on orange and yellow, light on green).
for (const tab of TABS) layers[`title-${tab}`]!.states = each(s => ({ opacity: s === tab ? 1 : 0, color: TITLE_COLOR[tab] }));

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Tabs, cells morph',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  // The tabs come in as a button, then the three cells one after the other as cards.
  layers: {
    tabs: { preset: 'button' },
    big: { preset: 'card' },
    small: { preset: 'card', delay: 'delay.70' },
    card: { preset: 'card', delay: 'delay.120' },
  },
  elements: { 'tab-ml': 'button', 'tab-trading': 'button', 'tab-technology': 'button' },
  interaction: {
    initial: 'ml',
    states: each(() => ({})),
    transitions: each(() => MORPH),
    layers,
    triggers: [
      { on: 'click', set: 'ml', target: 'tab-ml' },
      { on: 'click', set: 'trading', target: 'tab-trading' },
      { on: 'click', set: 'technology', target: 'tab-technology' },
      { on: 'arrows', states: ['ml', 'trading', 'technology'] },
    ],
  },
  lineage: 'imported from https://www.figma.com/design/HuYFjaWLJq5X1UHQw2z63w/Jane-Street-%E2%80%94-Website-%C2%B7-Design-Implementation-WIP?node-id=23804-26659',
};

export default v1;
