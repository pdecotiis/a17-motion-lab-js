import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v8: the opening's menu. Every part of it has a time of its own from the start of the opening (so none of them depends on the end of another entrance), and each part's look at rest is the look it ends in.
//   0 to 300ms: only the logomark shows (the menu is 304px wide, as in the frame, but the logo is cropped to its mark and the navigation is not shown), white on the dark, and it comes in with the card preset
//   (fades, rises 24px, scales up from 95%, 300ms; the scale on expressive-entrance).
//   900 to 1340ms: when the title is done, the three rings of the mark turn to the state of the third frame, every ring with its gap at the bottom, lined up, and go from white to the accent orange (800ms, expressive-standard).
//   The turns are the frame's own: in Figma its three rings are rotated -152 (outer), +70 (middle) and -54 degrees (inner), and Figma counts anticlockwise, so in CSS they turn +152, -70 and +54 (laid over the frame's
//   exported SVG they cover it exactly).
//   2140ms on: when the page has finished going to white, the sidebar (the navigation, then the sidebar button and the mode switch) comes in from the left: each slides in from 24px to its left and fades in, 400ms on
//   expressive-entrance, together with the header (from the top) and the bento's sequence.
const v2i = v2.interaction!;
const QUICK = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-entrance' };
const WHITE = 'var(--text-inverse)', ORANGE = 'var(--background-accent-primary)', DARK = 'var(--text-default)';
const TURN = { model: 'tween' as const, duration: 'duration.800', easing: 'easing.expressive-standard', delay: 'duration.300' };
// the logo's crop opens from the mark to the whole logo, and the wordmark slides in from its left, as the sidebar comes in
const OPEN_CLIP = {
  model: { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-entrance', delay: 'duration.2140' },
  keyframes: [{ clipPath: 'inset(-32px 133px -32px 0px)', offset: 0 }, { clipPath: 'inset(-32px 0px -32px 0px)', offset: 1 }],
};
const WORDMARK = {
  model: { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-entrance', delay: 'duration.2140' },
  keyframes: [{ opacity: 0, transform: 'translateX(-{distance.24})', offset: 0 }, { opacity: 1, transform: 'translateX(0px)', offset: 1 }],
};
const FROM_LEFT = {
  model: { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-entrance', delay: 'duration.2140' },
  keyframes: [{ opacity: 0, transform: 'translateX(-{distance.24})', offset: 0 }, { opacity: 1, transform: 'translateX(0px)', offset: 1 }],
};

// Each ring makes one long move from 300ms (with the title) to 2360ms: it unlocks (turns to the third frame's look and goes from white to orange, 300 to 700ms), holds, and goes home with the sidebar (2740 to
// 2360ms: back to the logo's own position and to the colour of the text). The tween's easing is linear and each segment has the curve of expressive-standard (its own cubic-bezier, as the Figma token), so every part eases
// as the unlock does. At rest the ring is home (the markup's look), so the move ends where the ring rests.
const EXPRESSIVE = 'cubic-bezier(0.45, 0.05, 0.35, 1)';
const LONG = { model: 'tween' as const, duration: 'duration.1660', easing: 'easing.linear', delay: 'duration.700' };
const ring = (turn: number) => ({
  restState: { transform: 'rotate(0deg)', fill: DARK },
  entrance: {
    model: LONG,
    keyframes: [
      { transform: 'rotate(0deg)', fill: WHITE, offset: 0, easing: EXPRESSIVE },
      { transform: `rotate(${turn}deg)`, fill: ORANGE, offset: 400 / 1660 },
      { transform: `rotate(${turn}deg)`, fill: ORANGE, offset: 1440 / 1660, easing: EXPRESSIVE },
      { transform: 'rotate(0deg)', fill: DARK, offset: 1 },
    ],
  },
});
const outer = ring(152), mid = ring(-70), inner = ring(54);

export const v8: MotionVersion = {
  ...v2,
  id: 'v8',
  label: 'Opening: logomark enters, rings unlock to orange, sidebar comes in from the left',
  layers: {
    'logo-mark': { preset: 'card' },
    'ring-outer': outer.entrance,
    'ring-mid': mid.entrance,
    'ring-inner': inner.entrance,
    logo: OPEN_CLIP,
    wordmark: WORDMARK,
    submenu: FROM_LEFT,
    actions: FROM_LEFT,
  },
  interaction: {
    initial: 'collapsed',
    // the menu looks collapsed (only the logomark: the sidebar comes in later) but keeps its 304px width, as the frame does: the page's content starts at 304px
    states: { collapsed: { width: '304px' }, open: { width: '304px' } },
    transitions: { collapsed: QUICK, open: QUICK },
    layers: {
      // the crop that leaves the mark reaches 32px above and below the logo, so the card preset's 24px rise is not clipped
      'ring-outer': { states: { collapsed: outer.restState, open: outer.restState }, transitions: { collapsed: QUICK, open: QUICK } },
      'ring-mid': { states: { collapsed: mid.restState, open: mid.restState }, transitions: { collapsed: QUICK, open: QUICK } },
      'ring-inner': { states: { collapsed: inner.restState, open: inner.restState }, transitions: { collapsed: QUICK, open: QUICK } },
      logo: { states: { collapsed: { clipPath: 'inset(-32px 0px -32px 0px)' }, open: { clipPath: 'inset(-32px 0px -32px 0px)' } }, transitions: { collapsed: QUICK, open: QUICK } },
    },
  },
  forkedFrom: 'v2',
};

export default v8;
