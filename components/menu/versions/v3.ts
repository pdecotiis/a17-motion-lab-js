import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v3: v2's entrance and collapse, with the stagger slowed so it can be seen. Everything comes in top to bottom, one after another, 70ms apart: the logo, the three
// menu items, then the sidebar button and the mode switch at the bottom (v2 has them 15ms apart, which reads as one move). Each is the button preset: it rises 8px
// on 140ms productive-standard while its own opacity fades in over 100ms.
export const v3: MotionVersion = {
  ...v2,
  id: 'v3',
  label: 'Rise in, one after another',
  layers: {
    row: { preset: 'button', delay: 'delay.15', stagger: 'delay.70' },
  },
  forkedFrom: 'v2',
};

export default v3;
