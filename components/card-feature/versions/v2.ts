import type { MotionVersion } from '../../../lab/lib/types.js';

// v1's entrance, plus the arrow button responds to the pointer by the button preset (hover tint, press scale, release).
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Arrow button: button preset',
  model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: '0ms' },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.24})', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  elements: { button: 'button' },
  forkedFrom: 'v1',
};

export default v2;
