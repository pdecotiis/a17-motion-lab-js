import type { MotionVersion } from '../../../lab/lib/types.js';
import { v3 } from './v3.js';

// v4: v3, for a page whose lights come up at 800ms (pattern v3): the title rises as they do.
export const v4: MotionVersion = {
  ...v3,
  id: 'v4',
  label: 'Rises as the lights come up (800ms in)',
  model: { model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.800' },
  forkedFrom: 'v3',
};

export default v4;
