import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v9: the white opening's menu. The page is white throughout and the rings do nothing: they stay as the logo has them.
//   0 to 300ms: only the logomark shows (the menu is 304px wide, as in the frame, but the logo is cropped to its mark and the navigation is not shown), and it comes in with the card preset (fades, rises 24px, scales up from
//   95%, 300ms; the scale on expressive-entrance).
//   1160ms on: the logo's crop opens and the wordmark ("Jane Street") slides in from its left, and the sidebar (the navigation, then the sidebar button and the mode switch) comes in from the left, all 400ms on expressive-entrance,
//   together with the header (from the top) and the bento's sequence (they start at the same moment, 1160ms, a beat after the last card is in).
const QUICK = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-entrance' };
const AT = 'duration.1160';
const OPEN_CLIP = {
  model: { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-entrance', delay: AT },
  keyframes: [{ clipPath: 'inset(-32px 133px -32px 0px)', offset: 0 }, { clipPath: 'inset(-32px 0px -32px 0px)', offset: 1 }],
};
const FROM_LEFT = {
  model: { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-entrance', delay: AT },
  keyframes: [{ opacity: 0, transform: 'translateX(-{distance.24})', offset: 0 }, { opacity: 1, transform: 'translateX(0px)', offset: 1 }],
};

export const v9: MotionVersion = {
  ...v2,
  id: 'v9',
  label: 'White opening: logomark enters, then the wordmark and sidebar come in from the left (1160ms)',
  layers: {
    'logo-mark': { preset: 'card' },
    logo: OPEN_CLIP,
    wordmark: FROM_LEFT,
    // the navigation items come in one after another, a stagger (15ms) apart, after the logo; the sidebar's bottom buttons (the sidebar button and the mode switch) after them, with the button preset (fade and rise)
    row: { preset: 'button', delay: 'duration.1175', stagger: 'delay.15' },
    actions: { preset: 'button', delay: 'duration.1250' },
  },
  interaction: {
    initial: 'collapsed',
    // the menu looks collapsed (only the logomark: the sidebar comes in later) but keeps its 304px width, as the frame does: the page's content starts at 304px
    states: { collapsed: { width: '304px' }, open: { width: '304px' } },
    transitions: { collapsed: QUICK, open: QUICK },
    layers: {
      // the crop at rest is the whole logo; its entrance starts from the mark alone (reaching 32px above and below, so the card preset's 24px rise is not clipped)
      logo: { states: { collapsed: { clipPath: 'inset(-32px 0px -32px 0px)' }, open: { clipPath: 'inset(-32px 0px -32px 0px)' } }, transitions: { collapsed: QUICK, open: QUICK } },
    },
  },
  forkedFrom: 'v8',
};

export default v9;
