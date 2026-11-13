import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v2: v1, but for a page that opens in a sequence (the pattern, then the title, then this, then the navigation and the header): it waits 800ms, then the stage fades in and the three
// colour cards rise in one after another, and the intro and the slides follow as in v1.
export const v2: MotionVersion = {
  ...v1,
  id: 'v2',
  label: 'Enters after the title (800ms in)',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'duration.800' },
  layers: { 'intro-card': { preset: 'card', delay: 'duration.800', stagger: 'delay.70' } },
  forkedFrom: 'v1',
};
delete (v2 as { lineage?: string }).lineage;

export default v2;
