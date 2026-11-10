import type { MotionVersion } from '../../../lab/lib/types.js';
import { v3 } from './v3.js';

// v3's motion, but on scroll each animated part plays as it appears (the card, then its title and text as each scrolls into view), not the whole
// card at once: the trigger's `each`. Elements that enter together start a beat apart.
const { lineage: _lineage, ...fromV3 } = v3;

export const v4: MotionVersion = {
  ...fromV3,
  id: 'v4',
  label: 'Fade Up, Each Part On Scroll',
  trigger: { on: 'in-view', threshold: 0.2, once: true, each: true },
  forkedFrom: 'v3',
};

export default v4;
