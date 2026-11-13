import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';
// v11: v8's opening with the page's elements coming in together with the page going to white (one movement): they start when the white starts, 120ms after the title, keeping their own small offsets; nothing waits for the white to finish.
// Retimed: the idle part of the wait after the title is halved (the black to white starts 120ms after the title instead of 240, and the page elements 60ms after it instead of 120); comments below that give the earlier times are the earlier sequence.

// v11: the opening's menu. The rings do not turn or change colour except to follow the page: white on the dark, the text colour once the page is white.
//   0 to 300ms: only the logomark shows (the menu is 304px wide, as in the frame, but the logo is cropped to its mark and the navigation is not shown), white on the dark, and it comes in with the card preset (fades, rises
//   24px, scales up from 95%, 300ms; the scale on expressive-entrance).
//   1890ms on: once the page has finished going to white, the wordmark ("Jane Street") comes in the way the logomark does: it fades in, rises and scales up (no crop), and the sidebar (the navigation, then the sidebar button and the mode switch) comes
//   in from the left, all 400ms on expressive-entrance, together with the header (from the top) and the bento's sequence.
const QUICK = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-entrance' };
// the rings are white on the dark and go to the text colour as the page goes white (the same time and curve as the page: from 1140ms, 400ms, expressive-entrance); they do not turn or change colour any other way
const WHITE = 'var(--text-inverse)', DARK = 'var(--text-default)';
const GO_DARK = {
  model: { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.1020' },
  keyframes: [{ fill: WHITE, offset: 0 }, { fill: DARK, offset: 1 }],
};
const RING_REST = { states: { collapsed: { fill: DARK }, open: { fill: DARK } }, transitions: { collapsed: QUICK, open: QUICK } };
const AT = 'duration.1090';

// The logomark's rings turn while the page is loading, and stop, in their own alignment, as the page's content comes in (1020ms): the outer ring turns clockwise, the middle one the other way, the inner one clockwise again, each a whole number
// of turns (1, 2 and 3) so they end where they began, with the gaps lined up; they speed up and slow to a stop (expressive-standard) and the last of the turning is done as the content arrives.
const turn = (deg: number) => ({
  model: { model: 'tween' as const, duration: 'duration.1020', easing: 'easing.expressive-standard' },
  keyframes: [{ transform: 'rotate(0deg)', offset: 0 }, { transform: `rotate(${deg}deg)`, offset: 1 }],
});
const SPIN = { 'spin-outer': turn(360), 'spin-mid': turn(-720), 'spin-inner': turn(1080) };

export const v11: MotionVersion = {
  ...v2,
  id: 'v11',
  label: 'Opening: the sidebar comes in with the page going to white',
  layers: {
    'logo-mark': { preset: 'card' },
    ...SPIN,
    'ring-outer': GO_DARK,
    'ring-mid': GO_DARK,
    'ring-inner': GO_DARK,
    // the wordmark comes in the way the logomark does (the card preset: it fades in, rises 24px and scales up from 95%), with nothing cropping it: the logo is whole from the start and only the mark shows until the wordmark arrives
    wordmark: { preset: 'card', delay: AT },
    // the navigation items come in one after another, a stagger (15ms) apart, after the logo; the sidebar's bottom buttons (the sidebar button and the mode switch) after them, with the button preset (fade and rise)
    row: { preset: 'button', delay: 'duration.1105', stagger: 'delay.15' },
    actions: { preset: 'button', delay: 'duration.1180' },
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
    },
  },
  forkedFrom: 'v8',
};

export default v11;
