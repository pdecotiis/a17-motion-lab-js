import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';
// Retimed: the idle part of the wait after the title is halved (the black to white starts 120ms after the title instead of 240, and the page elements 60ms after it instead of 120); comments below that give the earlier times are the earlier sequence.

// v8: the opening's menu. The rings do not turn or change colour except to follow the page: white on the dark, the text colour once the page is white.
//   0 to 300ms: only the logomark shows (the menu is 304px wide, as in the frame, but the logo is cropped to its mark and the navigation is not shown), white on the dark, and it comes in with the card preset (fades, rises
//   24px, scales up from 95%, 300ms; the scale on expressive-entrance).
//   1890ms on: once the page has finished going to white, the logo's crop opens and the wordmark ("Jane Street") slides in from its left, and the sidebar (the navigation, then the sidebar button and the mode switch) comes
//   in from the left, all 400ms on expressive-entrance, together with the header (from the top) and the bento's sequence.
const QUICK = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-entrance' };
// the rings are white on the dark and go to the text colour as the page goes white (the same time and curve as the page: from 1140ms, 400ms, expressive-entrance); they do not turn or change colour any other way
const WHITE = 'var(--text-inverse)', DARK = 'var(--text-default)';
const GO_DARK = {
  model: { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.1020' },
  keyframes: [{ fill: WHITE, offset: 0 }, { fill: DARK, offset: 1 }],
};
const RING_REST = { states: { collapsed: { fill: DARK }, open: { fill: DARK } }, transitions: { collapsed: QUICK, open: QUICK } };
const AT = 'duration.1710';
const OPEN_CLIP = {
  model: { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-entrance', delay: AT },
  keyframes: [{ clipPath: 'inset(-32px 133px -32px 0px)', offset: 0 }, { clipPath: 'inset(-32px 0px -32px 0px)', offset: 1 }],
};
const FROM_LEFT = {
  model: { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-entrance', delay: AT },
  keyframes: [{ opacity: 0, transform: 'translateX(-{distance.24})', offset: 0 }, { opacity: 1, transform: 'translateX(0px)', offset: 1 }],
};

export const v8: MotionVersion = {
  ...v2,
  id: 'v8',
  label: 'Opening: logomark enters, wordmark and sidebar come in from the left',
  layers: {
    'logo-mark': { preset: 'card' },
    'ring-outer': GO_DARK,
    'ring-mid': GO_DARK,
    'ring-inner': GO_DARK,
    logo: OPEN_CLIP,
    wordmark: FROM_LEFT,
    // the navigation items come in one after another, a stagger (15ms) apart, after the logo; the sidebar's bottom buttons (the sidebar button and the mode switch) after them, with the button preset (fade and rise)
    row: { preset: 'button', delay: 'duration.1725', stagger: 'delay.15' },
    actions: { preset: 'button', delay: 'duration.1800' },
  },
  interaction: {
    initial: 'collapsed',
    // the menu looks collapsed (only the logomark: the sidebar comes in later) but keeps its 304px width, as the frame does: the page's content starts at 304px
    states: { collapsed: { width: '304px' }, open: { width: '304px' } },
    transitions: { collapsed: QUICK, open: QUICK },
    layers: {
      // the crop at rest is the whole logo; its entrance starts from the mark alone (reaching 32px above and below, so the card preset's 24px rise is not clipped)
      'ring-outer': RING_REST,
      'ring-mid': RING_REST,
      'ring-inner': RING_REST,
      logo: { states: { collapsed: { clipPath: 'inset(-32px 0px -32px 0px)' }, open: { clipPath: 'inset(-32px 0px -32px 0px)' } }, transitions: { collapsed: QUICK, open: QUICK } },
    },
  },
  forkedFrom: 'v2',
};

export default v8;
