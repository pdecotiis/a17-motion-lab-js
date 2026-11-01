import type { MotionVersion } from '../../../lab/lib/types.js';

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Fade Up',
  model: {
    model: 'tween',
    duration: 'duration.220',
    easing: 'easing.productive-entrance',
    delay: '0ms',
  },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.16})', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  stagger: 'delay.70',
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  status: 'in-progress',
  lineage: 'imported from seed component (no import source)',
};

export default v1;
