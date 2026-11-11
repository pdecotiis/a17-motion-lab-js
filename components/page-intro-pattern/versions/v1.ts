import type { MotionVersion } from '../../../lab/lib/types.js';

// v1: the background pattern is simply there from the first frame and stays (the dots move by themselves and follow the pointer: see pattern/runtime.ts). A version needs
// an entrance, so this one is a fade from fully visible to fully visible (nothing moves). The sections fade in on top of it with no wait; the pattern fades out by itself as the page scrolls (pattern/runtime.ts).
export const v1: MotionVersion = {
  id: 'v1',
  label: 'Always there',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  lineage: 'new, from the old Motion Lab search modal (the site interactive dot field)',
};

export default v1;
