import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v10: the menu of the opening of page version v13. The whole logo (the mark and the wordmark) is there from the start and stays: it comes in like a card (the card preset: it rises 24px, scales up from 95% and fades in, 300ms), white on the dark, and goes to the text
// colour as the page goes white (from 1140ms, 560ms, expressive-entrance). The rings do not turn and nothing is cropped or revealed.
//   1905ms on (after the header, the first of the page's elements, at 1820ms): the navigation items come in one by one (15ms apart) and the sidebar's bottom buttons (1980ms): each rises, scales up from 95% and fades in with the card preset.
const QUICK = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-entrance' };
// the logo's rings and letters are white on the dark and go to the text colour as the page goes white (the same time and curve as the page: from 1140ms, 560ms, expressive-entrance); they do not change colour any other way
const WHITE = 'var(--text-inverse)', DARK = 'var(--text-default)';
const GO_DARK = {
  model: { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.1140' },
  keyframes: [{ fill: WHITE, offset: 0 }, { fill: DARK, offset: 1 }],
};
const RING_REST = { states: { collapsed: { fill: DARK }, open: { fill: DARK } }, transitions: { collapsed: QUICK, open: QUICK } };

export const v10: MotionVersion = {
  ...v2,
  id: 'v10',
  label: 'Opening v13: the full logo comes in like a card at the start and stays; nav rises in after the header',
  layers: {
    'logo-mark': { preset: 'card' },
    'ring-outer': GO_DARK,
    'ring-mid': GO_DARK,
    'ring-inner': GO_DARK,
    wordmark: GO_DARK,
    // the navigation items come in one after another, a stagger (15ms) apart; the sidebar's bottom buttons (the sidebar button and the mode switch) after them, with the card preset
    row: { preset: 'card', delay: 'duration.1905', stagger: 'delay.15' },
    actions: { preset: 'card', delay: 'duration.1980' },
  },
  interaction: {
    initial: 'collapsed',
    // the menu keeps its 304px width from the start (the sidebar's items come in later), as the frame does: the page's content starts at 304px
    states: { collapsed: { width: '304px' }, open: { width: '304px' } },
    transitions: { collapsed: QUICK, open: QUICK },
    layers: {
      // the logo at rest is dark; its entrance starts white
      'ring-outer': RING_REST,
      'ring-mid': RING_REST,
      'ring-inner': RING_REST,
      wordmark: RING_REST,
    },
  },
  forkedFrom: 'v8',
};

export default v10;
