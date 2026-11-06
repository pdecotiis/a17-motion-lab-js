import type { MotionVersion } from '../../../lab/lib/types.js';

// Expressive: a longer expressive entrance with a bigger rise (photos and cards also scale up), and a slower
// cascade between the parts. Plays once, when the section scrolls into view.
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Expressive',
  model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance' },
  keyframes: [
    { opacity: 0, offset: 0 },
    { opacity: 1, offset: 1 },
  ],
  layers: {
    'quote-card-1': {
      model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance', delay: 'delay.40' },
      keyframes: [
        { opacity: 0, transform: 'translateX({distance.52})', offset: 0 },
        { opacity: 1, transform: 'translateX(0px)', offset: 1 },
      ],
    },
    'quote-card-2': {
      model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance', delay: 'duration.200' },
      keyframes: [
        { opacity: 0, transform: 'translateX({distance.52})', offset: 0 },
        { opacity: 1, transform: 'translateX(0px)', offset: 1 },
      ],
    },
    'pagination': {
      model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance', delay: 'duration.400' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.20})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
  },
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v1',
};

export default v3;
