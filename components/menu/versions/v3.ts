import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v3: the menu for the homepage opening. The page opens with no menu: the logo is there, at (32, 32), and nothing else of the menu. A moment later (on the clock
// the bento shares, the `sequence` trigger) the menu slides in from the left: its width grows from 0 to 304px, which pushes the page's content (and the bento,
// whose cells follow the width) to the right, while the nav and the buttons slide in and fade up. The logo does not move with the menu: it stays where it is, and
// only its padding settles, from (32, 32) to its place in the menu at (24, 24). Then it is v2: the round button collapses the menu to the mark and opens it again.
// Fast: 300ms for the width, the nav 220ms a beat after it starts.
const OPEN = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const FADE = { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-entrance' };
const FADE_OUT = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-entrance' };
// the menu's own overflow stays visible so the logo is seen while the menu is no wider than it (v2 clips it to the mark by the logo's own crop)
const around = (width: string, padding: string) => ({ width, paddingLeft: padding, paddingRight: padding, overflow: 'visible' });

export const v3: MotionVersion = {
  ...v2,
  id: 'v3',
  label: 'Opening: only the nav slides in',
  // nothing rises in: the logo is on screen from the first frame
  layers: undefined as never,
  interaction: {
    ...v2.interaction!,
    initial: 'intro',
    states: {
      intro: around('0px', '0px'),
      open: around('304px', '24px'),
      collapsed: around('96px', '24px'),
    },
    transitions: {
      intro: OPEN,
      open: OPEN,
      collapsed: { ...v2.interaction!.transitions['collapsed']!, delay: 'delay.40' },
    },
    layers: {
      // the nav slides in from the left while it fades up (a beat after the width starts), and fades out first on its way to the mark
      submenu: {
        states: { intro: { opacity: 0, transform: 'translateX(-24px)' }, open: { opacity: 1, transform: 'translateX(0px)' }, collapsed: { opacity: 0, transform: 'translateX(0px)' } },
        transitions: { intro: FADE_OUT, open: { ...FADE, delay: 'delay.40' }, collapsed: FADE_OUT },
      },
      // the round button and the mode switch come in with it
      actions: {
        states: { intro: { opacity: 0, transform: 'translateX(-24px)' }, open: { opacity: 1, transform: 'translateX(0px)' }, collapsed: { opacity: 1, transform: 'translateX(0px)' } },
        transitions: { intro: FADE_OUT, open: { ...FADE, delay: 'delay.40' }, collapsed: FADE_OUT },
      },
      theme: v2.interaction!.layers!['theme']!,
      // the logo's padding settles into its place in the menu; the crop is v2's, for collapsing to the mark
      logo: {
        states: {
          intro: { clipPath: 'inset(-16px 0px -16px 0px)', marginLeft: '32px', marginTop: '8px' },
          open: { clipPath: 'inset(-16px 0px -16px 0px)', marginLeft: '0px', marginTop: '0px' },
          collapsed: { clipPath: 'inset(-16px 133px -16px 0px)', marginLeft: '0px', marginTop: '0px' },
        },
        transitions: { intro: OPEN, open: OPEN, collapsed: { ...OPEN, delay: 'delay.40' } },
      },
    },
    triggers: [
      { on: 'click', toggle: ['open', 'collapsed'], target: 'close' },
      // the opening: the menu slides in when the bento settles (same moment as its last scene)
      { on: 'sequence', steps: [['open', '750ms']] },
    ],
  },
  forkedFrom: 'v2',
};

export default v3;
