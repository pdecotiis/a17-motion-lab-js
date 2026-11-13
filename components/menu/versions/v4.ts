import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v4: v2, for a page that opens in a sequence (the pattern, then the title, then the bento, then the navigation and the header): the rows come in last, from 1200ms, one after another as in v2.
export const v4: MotionVersion = {
  ...v2,
  id: 'v4',
  label: 'Rows come in last (1200ms in)',
  layers: { 'logo-mark': { preset: 'button', delay: 'duration.1200' }, row: { preset: 'button', delay: 'duration.1200', stagger: 'delay.15' } },
  forkedFrom: 'v2',
};

export default v4;
