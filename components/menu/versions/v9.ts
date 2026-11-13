import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';
// Retimed: the page elements come in together, starting 120ms after the title (with the page going to white where there is one), as in page version v11.
// Retimed: the idle part of the wait after the title is halved (the page elements come in 370ms after the title instead of 740); comments below that give the earlier times are the earlier sequence.

// v9: the white opening's menu (page version v12). The page is white throughout and the logo does not change colour. The whole logo, the mark and the wordmark, comes in at the start with the card preset (it rises 24px, scales up
// from 95% and fades in, 300ms), as in v10 of this menu. The navigation comes in with the header, 1 second after the title's last line has faded in (1640ms), as the pattern settles: the items one after another, 15ms apart, then the sidebar's bottom buttons
// (the sidebar button and the mode switch), each with the button preset.
const QUICK = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-entrance' };

// The logomark's rings turn while the page is loading, and stop, in their own alignment, as the page's content comes in (1020ms): the outer ring turns clockwise, the middle one the other way, the inner one clockwise again, each a whole number
// of turns (1, 2 and 3) so they end where they began, with the gaps lined up; they speed up and slow to a stop (expressive-standard) and the last of the turning is done as the content arrives.
const turn = (deg: number) => ({
  model: { model: 'tween' as const, duration: 'duration.1020', easing: 'easing.expressive-standard' },
  keyframes: [{ transform: 'rotate(0deg)', offset: 0 }, { transform: `rotate(${deg}deg)`, offset: 1 }],
});
const SPIN = { 'spin-outer': turn(360), 'spin-mid': turn(-720), 'spin-inner': turn(1080) };

export const v9: MotionVersion = {
  ...v2,
  id: 'v9',
  label: 'White opening: the full logo comes in like a card; the nav comes in with the header (1640ms)',
  layers: {
    'logo-mark': { preset: 'card' },
    ...SPIN,
    row: { preset: 'button', delay: 'duration.1105', stagger: 'delay.15' },
    actions: { preset: 'button', delay: 'duration.1180' },
  },
  interaction: {
    initial: 'collapsed',
    // the menu keeps its 304px width from the start (the page's content starts at 304px); the sidebar's items come in later
    states: { collapsed: { width: '304px' }, open: { width: '304px' } },
    transitions: { collapsed: QUICK, open: QUICK },
  },
  forkedFrom: 'v8',
};

export default v9;
