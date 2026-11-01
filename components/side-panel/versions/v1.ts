import type { MotionVersion } from '../../../lab/lib/types.js';

// A tween: the panel slides in along the expressive-entrance curve and fades in. The baseline to
// compare the springs against.
export const v1: MotionVersion = {
  id: 'v1',
  label: 'Slide In',
  model: {
    model: 'tween',
    duration: 'duration.400',
    easing: 'easing.expressive-entrance',
  },
  keyframes: [
    { opacity: 0, transform: 'translateX({distance.48})', offset: 0 },
    { opacity: 1, transform: 'translateX(0px)', offset: 1 },
  ],
  trigger: { on: 'click' },
  status: 'in-progress',
  lineage: 'hand-built example for comparing CSS and Motion',
};

export default v1;
