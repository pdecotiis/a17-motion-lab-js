import type { MotionVersion } from '../../../lab/lib/types.js';

// The same slide as a spring with a clear bounce. Under Motion the panel overshoots its resting
// position and settles back; duration.560 is when it visually arrives. CSS has no spring, so it plays
// the same from/to values along expressive-entrance and never overshoots.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Slide In, Spring',
  model: {
    model: 'spring',
    duration: 'duration.560',
    easing: 'easing.expressive-entrance',
    bounce: 0.5,
    properties: [
      { property: 'transform', wrapTransform: 'translateX', unit: 'px', from: 48, to: 0 },
      { property: 'opacity', from: 0, to: 1 },
    ],
  },
  trigger: { on: 'click' },
  status: 'in-progress',
  forkedFrom: 'v1',
};

export default v2;
