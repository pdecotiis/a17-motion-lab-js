import type { MotionVersion } from '../../../lab/lib/types.js';

// Scale In uses the real spring engine (springKeyframes → WAAPI).
// 'scale' is spring-simulated; 'opacity' fades in linearly alongside it.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Scale In',
  model: {
    model: 'spring',
    bounce: 0.4,
    duration: 'motion.springs.bouncy',
    properties: [
      { property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1, span: 1, useSpring: true },
      { property: 'opacity', from: 0, to: 1, span: 1, useSpring: false },
    ],
  },
  stagger: '100ms',
  status: 'in-progress',
  forkedFrom: 'v1',
};

export default v2;
