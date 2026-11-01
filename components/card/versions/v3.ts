import type { MotionVersion } from '../../../lab/lib/types.js';

// Archived example: kept for history, hidden from the lab by default.
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Slow Fade',
  model: {
    model: 'tween',
    duration: 'duration.400',
    easing: 'easing.expressive-entrance',
    delay: '0ms',
  },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.8})', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  stagger: 'delay.70',
  status: 'archived',
  forkedFrom: 'v1',
};

export default v3;
