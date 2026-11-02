import type { MotionVersion } from '../../../lab/lib/types.js';

// Open / Close: the panel as two states, closed and open, and the transition into each. Going to open
// is the bouncy spring of v2 (bounce.50); going to closed is a plain exit with no bounce. Under CSS
// both play their easing curves (CSS has no spring); under Motion both are springs. Clicking the ×
// (the layer named "close") closes it. Opening comes from outside the component (a button elsewhere
// on the page), so in the lab you open it with the state buttons.
export const v4: MotionVersion = {
  id: 'v4',
  label: 'Open / Close',
  interaction: {
    initial: 'closed',
    states: {
      closed: { opacity: 0, transform: 'translateX({distance.48})' },
      open: { opacity: 1, transform: 'translateX(0px)' },
    },
    transitions: {
      open: { model: 'spring', duration: 'duration.560', easing: 'easing.expressive-entrance', bounce: 'bounce.50' },
      closed: { model: 'spring', duration: 'duration.300', easing: 'easing.productive-exit', bounce: 'bounce.0' },
    },
    triggers: [{ on: 'click', target: 'close', set: 'closed' }],
  },
  trigger: { on: 'click' },
  status: 'in-progress',
  forkedFrom: 'v2',
};

export default v4;
