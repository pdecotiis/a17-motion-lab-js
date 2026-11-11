import type { MotionVersion } from '../../../lab/lib/types.js';

// v1: the background pattern is simply there from the first frame and stays. A version needs an entrance, so this one is a fade from fully visible to fully
// visible (nothing moves): the page's `hold` then makes the sections wait before they fade in on top of it, and this one, being identical at both ends, shows
// the whole time.
export const v1: MotionVersion = {
  id: 'v1',
  label: 'Always there',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  lineage: 'new, from the dotted background image supplied by the designer',
};

export default v1;
