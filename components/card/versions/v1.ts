import type { MotionVersion } from '../../../lab/lib/types.js';

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Fade Up',
  model: {
    model: 'tween',
    duration: 'motion.timings.base',
    easing: 'motion.easings.ease-out',
    delay: '0ms',
  },
  keyframes: [
    { opacity: 0, transform: 'translateY(16px)', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  stagger: '80ms',
  status: 'in-progress',
  lineage: 'imported from seed component (no import source)',
};

export default v1;
