import type { MotionVersion } from '../../../lab/lib/types.js';
import { v3 } from './v3.js';

// v4: v3, for a page that opens in a sequence (the pattern, then the title, then the bento, then the navigation and the header): the header comes last, 1200ms in.
export const v4: MotionVersion = {
  ...v3,
  id: 'v4',
  label: 'Comes in last (1200ms in)',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'duration.1200' },
  layers: {
    search: { preset: 'button', delay: 'duration.1200' },
    join: { preset: 'button', delay: 'duration.1200', stagger: 'delay.40' },
  },
  forkedFrom: 'v3',
};

export default v4;
