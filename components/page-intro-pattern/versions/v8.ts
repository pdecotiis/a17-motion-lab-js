import type { MotionVersion } from '../../../lab/lib/types.js';
import { v6 } from './v6.js';

// v8: v6's pattern (page white throughout; the dots start at 35%, settle to their 12% from 1640ms over 560ms, and the page-coloured edge comes in with the page), with the dots in an accent colour (one of the page's four, a different one each time)
// in the intro: the dots start in an accent colour and their colour fades to the grey they have at rest as they settle, over the same 560ms, with the same curve. The dots' own colour moves, so nothing flashes. The accent changes on every
// play (a reload or a replay) and goes round the page's four accents: orange, yellow-green, green and indigo (the runtime picks it, see tintNow in pattern/runtime.ts).
export const v8: MotionVersion = {
  ...v6,
  id: 'v8',
  label: 'White opening: the pattern starts strong in an accent colour (a new one each time) and settles to grey',
  layers: {
    ...v6.layers,
    tint: {
      model: { model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.1640' },
      keyframes: [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 1 }],
    },
  },
  forkedFrom: 'v6',
};

export default v8;
