import type { MotionVersion } from '../../../lab/lib/types.js';

// Expressive: a longer expressive entrance with a bigger rise (photos and cards also scale up), and a slower
// cascade between the parts. Plays once, when the section scrolls into view.
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Expressive',
  model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-entrance' },
  keyframes: [
    { opacity: 0, offset: 0 },
    { opacity: 1, offset: 1 },
  ],
  layers: {
    'label-row': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-entrance', delay: 'delay.40' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.32})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    'title': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-entrance', delay: 'delay.120' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.32})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    'description': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-entrance', delay: 'duration.220' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.32})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    'media': {
      model: { model: 'tween', duration: 'duration.1200', easing: 'easing.expressive-entrance', delay: 'duration.220' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.32}) scale({scale.95})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 },
      ],
    },
    'caption': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-entrance', delay: 'duration.800' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.32})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
  },
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v1',
};

export default v3;
