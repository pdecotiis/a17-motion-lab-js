import type { MotionVersion } from '../../../lab/lib/types.js';

// v1's entrance, plus the arrow button's hover, press and release from the Figma presets frame (the ghost icon button):
// hover: a fill of black at 4% fades in over 100ms productive-standard (and out the same way); press: the button scales to 97% in 100ms
// productive-standard and the fill goes to black at 8%; release: back to 100% (or to hovered if the pointer is still on it) in 140ms
// productive-entrance. The fill is its own layer (button-fill) so its timing is apart from the scale's. interactive/hovered and
// interactive/pressed are the Figma colours, written as literals.
const FILL = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-standard' };
const PRESS = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-standard' };
const RELEASE = { model: 'tween' as const, duration: 'duration.140', easing: 'easing.productive-entrance' };

export const v2: MotionVersion = {
  id: 'v2',
  label: 'Arrow button: hover, press, release',
  model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: '0ms' },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.24})', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  interaction: {
    initial: 'default',
    states: { default: {}, hovered: {}, pressed: {} },
    transitions: { default: RELEASE, hovered: RELEASE, pressed: PRESS },
    layers: {
      button: {
        states: { default: { transform: 'scale(1)' }, hovered: { transform: 'scale(1)' }, pressed: { transform: 'scale({scale.97})' } },
        transitions: { default: RELEASE, hovered: RELEASE, pressed: PRESS },
      },
      'button-fill': {
        states: {
          default: { backgroundColor: 'rgba(0, 0, 0, 0)' },
          hovered: { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
          pressed: { backgroundColor: 'rgba(0, 0, 0, 0.08)' },
        },
        transitions: { default: FILL, hovered: FILL, pressed: FILL },
      },
    },
    triggers: [
      { on: 'hover', state: 'hovered', target: 'button' },
      { on: 'press', state: 'pressed', target: 'button' },
    ],
  },
  forkedFrom: 'v1',
};

export default v2;
