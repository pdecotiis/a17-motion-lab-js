import type { MotionVersion } from '../../../lab/lib/types.js';
import { v4 } from './v4.js';

// v5: v4, but last of all: the rows come in from 1600ms, once the bento is on its way.
export const v5: MotionVersion = {
  ...v4,
  id: 'v5',
  label: 'Rows come in last (1600ms in)',
  layers: { 'logo-mark': { preset: 'button', delay: 'duration.1600' }, row: { preset: 'button', delay: 'duration.1600', stagger: 'delay.15' } },
  forkedFrom: 'v4',
};

export default v5;
