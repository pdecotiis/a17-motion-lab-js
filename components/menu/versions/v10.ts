import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';
// Retimed: the page elements come in together, starting 120ms after the title (with the page going to white where there is one), as in page version v11.
// Retimed: the idle part of the wait after the title is halved (the black to white starts 120ms after the title instead of 240, and the page elements 60ms after it instead of 120); comments below that give the earlier times are the earlier sequence.

// v10: the menu of the opening of page version v13. The whole logo (the mark and the wordmark) is there from the start and stays: it comes in like a card (the card preset: it rises 24px, scales up from 95% and fades in, 300ms), white on the dark, and goes to the text
// colour as the page goes white (from 1140ms, 560ms, expressive-entrance). The rings do not turn and nothing is cropped or revealed.
//   1905ms on (after the header, the first of the page's elements, at 1820ms): the navigation items come in one by one (15ms apart) and the sidebar's bottom buttons (1980ms): each rises, scales up from 95% and fades in with the card preset.
const QUICK = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-entrance' };
// the logo's rings and letters are white on the dark and go to the text colour as the page goes white (the same time and curve as the page: from 1140ms, 560ms, expressive-entrance); they do not change colour any other way
const WHITE = 'var(--text-inverse)', DARK = 'var(--text-default)';
const GO_DARK = {
  model: { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.1020' },
  keyframes: [{ fill: WHITE, offset: 0 }, { fill: DARK, offset: 1 }],
};
const RING_REST = { states: { collapsed: { fill: DARK }, open: { fill: DARK } }, transitions: { collapsed: QUICK, open: QUICK } };

// The logomark's rings turn while the page is loading, and stop, in their own alignment, as the page's content comes in (1020ms): the outer ring turns clockwise, the middle one the other way, the inner one clockwise again, each a whole number
// of turns (1, 2 and 3) so they end where they began, with the gaps lined up; they speed up and slow to a stop (expressive-standard) and the last of the turning is done as the content arrives.
const turn = (deg: number) => ({
  model: { model: 'tween' as const, duration: 'duration.1020', easing: 'easing.expressive-standard' },
  keyframes: [{ transform: 'rotate(0deg)', offset: 0 }, { transform: `rotate(${deg}deg)`, offset: 1 }],
});
const SPIN = { 'spin-outer': turn(360), 'spin-mid': turn(-720), 'spin-inner': turn(1080) };

export const v10: MotionVersion = {
  ...v2,
  id: 'v10',
  label: 'Opening v13: the full logo comes in like a card at the start and stays; nav rises in after the header',
  layers: {
    'logo-mark': { preset: 'card' },
    ...SPIN,
    'ring-outer': GO_DARK,
    'ring-mid': GO_DARK,
    'ring-inner': GO_DARK,
    wordmark: GO_DARK,
    // the navigation items come in one after another, a stagger (15ms) apart; the sidebar's bottom buttons (the sidebar button and the mode switch) after them, with the card preset
    row: { preset: 'card', delay: 'duration.1105', stagger: 'delay.15' },
    actions: { preset: 'card', delay: 'duration.1180' },
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
