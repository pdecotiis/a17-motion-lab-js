import type { MotionVersion } from '../../../lab/lib/types.js';

// Archived example: kept for history, hidden from the lab by default.
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Slow Fade',
  model: {
    model: 'tween',
    duration: 'motion.timings.slow',
    easing: 'motion.easings.ease-out',
    delay: '0ms',
  },
  keyframes: [
    { opacity: 0, transform: 'translateY(8px)', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  stagger: '80ms',
  status: 'archived',
  forkedFrom: 'v1',
};

export default v3;
