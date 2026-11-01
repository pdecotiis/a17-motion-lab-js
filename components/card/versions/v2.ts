import type { MotionVersion } from '../../../lab/lib/types.js';

// Scale In is authored as a spring of productive-entrance (duration.300). CSS has no real spring, so
// the lab plays and exports its from/to values with the easing curve; only a spring runtime (Motion)
// plays it as a spring.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Scale In',
  model: {
    model: 'spring',
    duration: 'duration.300',
    easing: 'easing.productive-entrance',
    properties: [
      { property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1 },
      { property: 'opacity', from: 0, to: 1 },
    ],
  },
  stagger: 'delay.120',
  status: 'in-progress',
  forkedFrom: 'v1',
};

export default v2;
