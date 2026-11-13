import type { MotionVersion } from '../../../lab/lib/types.js';
import { v6 } from './v6.js';

// v7: v6, for the white opening. The cards come in the same way; the bento's first move comes 100ms after they are in (1160ms: the cards are in at 1060ms), at the same moment as the header, the wordmark and the sidebar.
export const v7: MotionVersion = {
  ...v6,
  id: 'v7',
  label: 'White opening: cards after the title, sequence starts with the header',
  interaction: { ...v6.interaction!, hold: 'duration.100' },
  forkedFrom: 'v6',
};

export default v7;
