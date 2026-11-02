import type { MotionVersion } from '../../../lab/lib/types.js';

// Open / Close: the panel as two states, closed and open, and the transition into each. Going to open
// is the bouncy spring of v2 (bounce.50); going to closed is a plain exit with no bounce. Under CSS
// both play their easing curves (CSS has no spring); under Motion both are springs. In the lab you
// move between states with the buttons, or by clicking the × inside the panel; interrupt a move
// halfway to see what each runtime does with the speed the panel had.
export const v4: MotionVersion = {
  id: 'v4',
  label: 'Open / Close',
  // By convention the timing of the first transition (into open), so panels that expect a model have one.
  model: { model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance' },
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
  },
  trigger: { on: 'click' },
  status: 'in-progress',
  forkedFrom: 'v2',
};

export default v4;
