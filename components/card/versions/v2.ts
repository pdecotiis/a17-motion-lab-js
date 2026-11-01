import type { MotionVersion } from '../../../lab/lib/types.js';

// Scale In plays productive-entrance as a spring: its bounce is the easing's (bounce-0), and the
// spring lasts duration.300 / 0.82. It is simulated by the real spring engine and shipped as a CSS
// linear() curve. 'scale' follows the spring; 'opacity' fades in linearly alongside it.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Scale In',
  model: {
    model: 'spring',
    duration: 'duration.300',
    easing: 'easing.productive-entrance',
    properties: [
      { property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1, span: 1, useSpring: true },
      { property: 'opacity', from: 0, to: 1, span: 1, useSpring: false },
    ],
  },
  stagger: 'delay.120',
  status: 'in-progress',
  forkedFrom: 'v1',
};

export default v2;
