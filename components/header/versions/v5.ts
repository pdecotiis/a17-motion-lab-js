import type { MotionVersion } from '../../../lab/lib/types.js';
import { v4 } from './v4.js';

// v5: the opening's header. It is there (it holds its 80px above the title) but not shown, and at the moment the page starts going to white, at 1360ms, it comes in from the top: it slides down from its own height above and
// fades in, 400ms on expressive-entrance, with the sidebar and the bento's sequence starting at the same moment. Its buttons keep their hover and press (the button preset).
const BUTTON_IN = [{ opacity: 0, transform: 'translateY(-{distance.12}) scale({scale.95})', offset: 0 }, { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }];

export const v5: MotionVersion = {
  ...v4,
  id: 'v5',
  label: 'Opening: comes in from the top as the page starts going to white (1360ms in)',
  // the header itself does not move: its two buttons do, one after the other (a stagger of 15ms): each scales up from 95%, fades in and moves down 12px into place (400ms on expressive-entrance)
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    search: { model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.1360' }, keyframes: BUTTON_IN },
    join: { model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.1375' }, keyframes: BUTTON_IN },
  },
  forkedFrom: 'v4',
};

export default v5;
