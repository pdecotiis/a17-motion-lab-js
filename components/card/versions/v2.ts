import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// Hover Lift: v1's entrance (the card rises and fades in, its text follows), then three states. Hovering
// lifts it 4px; pressing settles it a little (98%); moving off returns it to rest, faster than it left.
// The entrance plays first and the states take over when it ends (it rests where the entrance ended).
// The triggers are declared here, so the markup stays as the Figma import made it.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Hover Lift',
  model: v1.model,
  keyframes: v1.keyframes,
  layers: v1.layers,
  stagger: v1.stagger,
  interaction: {
    initial: 'rest',
    states: {
      rest: { transform: 'none' },
      hover: { transform: 'translateY(-{distance.4})' },
      pressed: { transform: 'translateY(-{distance.4}) scale({scale.98})' },
    },
    transitions: {
      hover: { model: 'tween', duration: 'duration.220', easing: 'easing.productive-standard' },
      pressed: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-standard' },
      rest: { model: 'spring', duration: 'duration.140', easing: 'easing.productive-exit', bounce: 'bounce.0' },
    },
    triggers: [
      { on: 'hover', state: 'hover' },
      { on: 'press', state: 'pressed' },
    ],
  },
  forkedFrom: 'v1',
};

export default v2;
