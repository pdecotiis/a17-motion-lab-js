import type { MotionVersion } from '../../../lab/lib/types.js';

// v1: the footer does not animate: it is there, as designed, from the first frame, with no entrance and no scroll trigger. (A version has to say something about motion, so it holds its opacity at 1.)
export const v1: MotionVersion = {
  id: 'v1',
  label: 'No animation',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  lineage: 'new: the footer of the Jane Street homepage frame (24053:67560)',
};

export default v1;
