import type { MotionVersion } from '../../../lab/lib/types.js';

// Hover Lift: the card as three states. Hovering lifts it 4px and the image scales to 103%; pressing
// settles it back a little (98%); moving off returns it to rest, faster than it left. The image is a
// layer of its own (data-motion="image") with its own, slower timing into hover. The triggers are
// declared here, so the markup stays as the Figma import made it.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Hover Lift',
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
    layers: {
      image: {
        states: {
          hover: { transform: 'scale({scale.103})' },
          pressed: { transform: 'scale({scale.103})' },
        },
        transitions: {
          hover: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-standard' },
        },
      },
    },
    triggers: [
      { on: 'hover', state: 'hover' },
      { on: 'press', state: 'pressed' },
    ],
  },
  trigger: { on: 'hover' },
  forkedFrom: 'v1',
};

export default v2;
