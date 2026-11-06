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
    'card': {
      model: { model: 'tween', duration: 'duration.1200', easing: 'easing.expressive-entrance', delay: 'delay.40' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.32}) scale({scale.95})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 },
      ],
    },
    'eyebrow': {
      model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance', delay: 'delay.120' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.32})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    'title': {
      model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance', delay: 'duration.200' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.32})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    'prompt-1': {
      model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance', delay: 'duration.200' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.20})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    'prompt-2': {
      model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance', delay: 'duration.250' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.20})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    'prompt-3': {
      model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance', delay: 'duration.400' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.20})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    'prompt-4': {
      model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance', delay: 'duration.700' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.20})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    'prompt-5': {
      model: { model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance', delay: 'duration.700' },
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
