import type { MotionVersion } from '../../../lab/lib/types.js';

// The sidebar's motion from the original Motion Lab's approved "Gliding highlight with hop" menu (jst-menu-highlight-v4), the parts this lab can play:
// Entrance: ONE sequence over everything on screen, top down in page order: the logo, each row and group label, then the sidebar button and the mode
// switch. Each starts delay.15 after the one before (the first at delay.15) and does the same thing: rises 8px on 140ms productive-standard while its own
// opacity fades in over 100ms on productive-entrance. That is the lab's "button" preset (rise 8px, move 140ms productive-standard, fade 100ms
// productive-entrance), which is those same weights, so the entrance is the preset on every element, staggered. Everything is one layer (row) so the
// stagger runs straight through it; the logo and the two buttons sit in wrappers so their own names (for collapsing) stay free.
// Collapse (click the round sidebar button): the nav and the mode switch fade out in 100ms, the width follows 40ms later to 96px on 140ms
// productive-standard, and the wordmark is cropped away leaving the mark; opening, the width leads and the content fades back 40ms after it starts.
// Not played here (the original does them and this lab has no way to say them yet): the group labels scrambling as they arrive, the gliding hover
// highlight that merges into the current page and hops across labels, groups that open and close, replaying the entrance when the sidebar reopens,
// and the mode switch's drag.
const RISE = { model: 'tween' as const, duration: 'duration.140', easing: 'easing.productive-standard' };

export const v2: MotionVersion = {
  id: 'v2',
  label: 'Rise in, collapse to the mark',
  // The sidebar itself stays put; the rows come in.
  model: { ...RISE, delay: '0ms' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    'logo-mark': { preset: 'button', delay: 'delay.15' },   // the logo is the first of the sequence, as it was when it was a row
    row: { preset: 'button', delay: 'delay.15', stagger: 'delay.15' },
  },
  interaction: {
    initial: 'open',
    states: {
      open: { width: '304px' },
      collapsed: { width: '96px' },
    },
    transitions: {
      // The width starts a beat after the fades begin; opening, it leads.
      collapsed: { ...RISE, delay: 'delay.40' },
      open: RISE,
    },
    layers: {
      // The nav (rows and labels) and the mode switch fade out first, and come back just after the width starts to open.
      submenu: {
        states: { open: { opacity: 1 }, collapsed: { opacity: 0 } },
        transitions: {
          collapsed: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
          open: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'delay.40' },
        },
      },
      theme: {
        states: { open: { opacity: 1 }, collapsed: { opacity: 0 } },
        transitions: {
          collapsed: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
          open: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'delay.40' },
        },
      },
      // The logo keeps its 48px mark: the wordmark (the other 133px of the 181px logo) is cropped away as the sidebar narrows.
      logo: {
        // The crop only takes from the right: the top and bottom reach 16px past the logo, so it is not clipped as it rises in.
        states: { open: { clipPath: 'inset(-16px 0px -16px 0px)' }, collapsed: { clipPath: 'inset(-16px 133px -16px 0px)' } },
        transitions: { collapsed: { ...RISE, delay: 'delay.40' }, open: RISE },
      },
    },
    triggers: [{ on: 'click', toggle: ['open', 'collapsed'], target: 'close' }],
  },
  forkedFrom: 'v1',
};

export default v2;
