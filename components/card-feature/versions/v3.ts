import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v3: v1's entrance, played when the section is scrolled to (a fifth of it showing) instead of when the page opens.
export const v3: MotionVersion = {
  ...v1,
  id: 'v3',
  label: 'Rises in as it is scrolled to',
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v1',
};
delete (v3 as { lineage?: string }).lineage;

export default v3;
