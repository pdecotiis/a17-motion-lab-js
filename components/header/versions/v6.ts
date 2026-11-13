import type { MotionVersion } from '../../../lab/lib/types.js';
import { v4 } from './v4.js';

// v6: the header of the white opening (page version v12). It is there (it holds its 80px above the title) but not shown, and 1 second after the title's last line has faded in (1640ms) it comes in with the nav: its two buttons each scale up
// from 95%, fade in and move down 12px into place, 15ms apart (400ms on expressive-entrance). The buttons keep their hover and press (the button preset).
const BUTTON_IN = [{ opacity: 0, transform: 'translateY(-{distance.12}) scale({scale.95})', offset: 0 }, { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }];

export const v6: MotionVersion = {
  ...v4,
  id: 'v6',
  label: 'White opening: comes in with the nav, 1 second after the title (1640ms in)',
  // the header itself does not move: its two buttons do, one after the other (a stagger of 15ms): each scales up from 95%, fades in and moves down 12px into place (400ms on expressive-entrance)
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    search: { model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.1640' }, keyframes: BUTTON_IN },
    join: { model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.1655' }, keyframes: BUTTON_IN },
  },
  forkedFrom: 'v5',
};

export default v6;
