import type { MotionVersion } from '../../../lab/lib/types.js';

// v3's entrance, plus the next button responds to the pointer by the button preset (hover tint, press scale, release). The previous button is
// disabled on the first quote, so it has no states here.

export const v4: MotionVersion = {
  id: 'v4',
  label: 'Expressive, next button preset',
  model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-entrance' },
  keyframes: [
    { opacity: 0, offset: 0 },
    { opacity: 1, offset: 1 },
  ],
  layers: {
    'quote-card-1': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-entrance', delay: 'delay.40' },
      keyframes: [
        { opacity: 0, transform: 'translateX({distance.48})', offset: 0 },
        { opacity: 1, transform: 'translateX(0px)', offset: 1 },
      ],
    },
    'quote-card-2': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-entrance', delay: 'duration.220' },
      keyframes: [
        { opacity: 0, transform: 'translateX({distance.48})', offset: 0 },
        { opacity: 1, transform: 'translateX(0px)', offset: 1 },
      ],
    },
    'pagination': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-entrance', delay: 'duration.400' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.24})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
  },
  elements: { 'button-next': 'button' },
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v3',
};

export default v4;
