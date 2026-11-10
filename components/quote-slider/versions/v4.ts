import type { MotionVersion } from '../../../lab/lib/types.js';

// v3's entrance, plus the next button's press and release from the Figma presets frame (the tertiary icon button, which has no hover colour):
// press: scales to 97% in 100ms productive-standard; release: back to 100% in 140ms productive-entrance. The previous button is disabled
// on the first quote, so it has no states here.
const PRESS = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-standard' };
const RELEASE = { model: 'tween' as const, duration: 'duration.140', easing: 'easing.productive-entrance' };

export const v4: MotionVersion = {
  id: 'v4',
  label: 'Expressive, next button press',
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
  interaction: {
    initial: 'default',
    states: { default: {}, pressed: {} },
    transitions: { default: RELEASE, pressed: PRESS },
    layers: {
      'button-next': {
        states: { default: { transform: 'scale(1)' }, pressed: { transform: 'scale({scale.97})' } },
        transitions: { default: RELEASE, pressed: PRESS },
      },
    },
    triggers: [{ on: 'press', state: 'pressed', target: 'button-next' }],
  },
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v3',
};

export default v4;
