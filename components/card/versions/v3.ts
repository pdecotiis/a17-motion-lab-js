import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v1's motion, played when the card scrolls into view instead of on load: what the Page view's scrolling
// preview is for. Its trigger says so, so the spec tells a developer the same.
const { lineage: _lineage, ...fromV1 } = v1;

export const v3: MotionVersion = {
  ...fromV1,
  id: 'v3',
  label: 'Fade Up, Plays On Scroll',
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v1',
};

export default v3;
