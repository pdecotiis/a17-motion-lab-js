import type { MotionVersion } from '../../../lab/lib/types.js';

// v6: the white opening's pattern. The page is white from the first frame and stays white: the dots fade in over 300ms on the light page and nothing changes after that (no lift to white, no rings).
const FADE = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-entrance' };

export const v6: MotionVersion = {
  id: 'v6',
  label: 'White opening: dots fade in on white, the page stays white',
  model: FADE,
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: { field: { model: FADE, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }] } },
  // the component starts and stays in its 'white' state (the runtime reads it as the light page; an interaction needs a second state to validate)
  interaction: { initial: 'white', states: { white: {}, dark: {} }, transitions: { white: FADE, dark: FADE } },
  forkedFrom: 'v5',
};

export default v6;
