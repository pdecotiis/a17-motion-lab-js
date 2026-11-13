import type { MotionVersion } from '../../../lab/lib/types.js';
import { v4 } from './v4.js';

// v5: the opening's header. It is there (it holds its 80px above the title) but not shown, and when the page has finished going to white, at 2140ms, it comes in from the top: it slides down from its own height above and
// fades in, 400ms on expressive-entrance, with the sidebar and the bento's sequence starting at the same moment. Its buttons keep their hover and press (the button preset).
export const v5: MotionVersion = {
  ...v4,
  id: 'v5',
  label: 'Opening: comes in from the top once the page is white (2140ms in)',
  model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.2140' },
  keyframes: [{ opacity: 0, transform: 'translateY(-100%)', offset: 0 }, { opacity: 1, transform: 'translateY(0%)', offset: 1 }],
  layers: {},
  forkedFrom: 'v4',
};

export default v5;
