import type { MotionVersion } from '../../../lab/lib/types.js';

// v2: the pattern is the first thing on a page that opens in a sequence: the dot field fades in from nothing, slowly (1200ms, the longest of the opening), while the title follows it.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Fades in first, slowly',
  model: { model: 'tween', duration: 'duration.1200', easing: 'easing.expressive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  forkedFrom: 'v1',
};

export default v2;
