import type { MotionVersion } from '../../../lab/lib/types.js';

// v2's entrance, plus the search button's hover, press and release from the Figma presets frame (the quaternary icon button):
// hover: the fill goes from the resting colour to the hovered one in 100ms productive-standard (and back the same way);
// press: the button scales to 97% in 100ms productive-standard, the fill darkens to the pressed colour; release: back to 100% (or to hovered, if the
// pointer is still on it) in 140ms productive-entrance. The fill is its own layer (search-fill) so its timing is the colour's, apart from the scale's.
// Colours are the Figma button's, as literals: background/quaternary (#dbdad8 at 90%), interactive/hovered and interactive/pressed (black 4% and 8%)
// at the variant's 90%. The Join button has no states here.
const FILL = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-standard' };
const PRESS = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-standard' };
const RELEASE = { model: 'tween' as const, duration: 'duration.140', easing: 'easing.productive-entrance' };

export const v3: MotionVersion = {
  id: 'v3',
  label: 'Search button: hover, press, release',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    search: { preset: 'button' },
    join: { preset: 'button', delay: 'delay.40' },
  },
  interaction: {
    initial: 'default',
    states: { default: {}, hovered: {}, pressed: {} },
    transitions: { default: RELEASE, hovered: RELEASE, pressed: PRESS },
    layers: {
      search: {
        states: { default: { transform: 'scale(1)' }, hovered: { transform: 'scale(1)' }, pressed: { transform: 'scale({scale.97})' } },
        transitions: { default: RELEASE, hovered: RELEASE, pressed: PRESS },
      },
      'search-fill': {
        states: {
          default: { backgroundColor: 'rgba(219, 218, 216, 0.9)' },
          hovered: { backgroundColor: 'rgba(0, 0, 0, 0.036)' },
          pressed: { backgroundColor: 'rgba(0, 0, 0, 0.072)' },
        },
        transitions: { default: FILL, hovered: FILL, pressed: FILL },
      },
    },
    triggers: [
      { on: 'hover', state: 'hovered', target: 'search' },
      { on: 'press', state: 'pressed', target: 'search' },
    ],
  },
  forkedFrom: 'v2',
};

export default v3;
