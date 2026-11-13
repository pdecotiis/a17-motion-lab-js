import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v9: the white opening's menu (page version v12). The page is white throughout and the logo does not change colour. The whole logo, the mark and the wordmark, comes in at the start with the card preset (it rises 24px, scales up
// from 95% and fades in, 300ms), as in v10 of this menu. The navigation comes in with the header, 1 second after the title's last line has faded in (1640ms), as the pattern settles: the items one after another, 15ms apart, then the sidebar's bottom buttons
// (the sidebar button and the mode switch), each with the button preset.
const QUICK = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-entrance' };

export const v9: MotionVersion = {
  ...v2,
  id: 'v9',
  label: 'White opening: the full logo comes in like a card; the nav comes in with the header (1640ms)',
  layers: {
    'logo-mark': { preset: 'card' },
    row: { preset: 'button', delay: 'duration.1640', stagger: 'delay.15' },
    actions: { preset: 'button', delay: 'duration.1715' },
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
