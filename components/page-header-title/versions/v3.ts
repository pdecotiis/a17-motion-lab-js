import type { MotionVersion } from '../../../lab/lib/types.js';

// v3: the title for a page that opens in a sequence (the pattern, then the title, then the bento, then the navigation and the header): it waits 400ms for the pattern, then comes into
// focus as it rises: it starts 32px low and transparent and settles over 560ms on the expressive entrance.
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Rises after the pattern (400ms in)',
  model: { model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.400' },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.32})', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  forkedFrom: 'v1',
};

export default v3;
