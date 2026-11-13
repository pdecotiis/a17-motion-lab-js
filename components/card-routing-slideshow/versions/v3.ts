import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v3: v2, for a page whose lights come up at 800ms (pattern v3): the bento comes in once the title is on its way, 1200ms in.
export const v3: MotionVersion = {
  ...v2,
  id: 'v3',
  label: 'Enters after the title (1200ms in)',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'duration.1200' },
  layers: { 'intro-card': { preset: 'card', delay: 'duration.1200', stagger: 'delay.70' } },
  forkedFrom: 'v2',
};

export default v3;
