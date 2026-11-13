import type { MotionVersion } from '../../../lab/lib/types.js';

// v4: scene one of the sequenced opening. The page is in the dark (near-black, the colour of the buttons) and the dots fade in over 300ms. Nothing else changes: it stays dark (the component's
// state is 'dark' and nothing takes it to 'light': the lights come up in a later scene).
const FADE = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-entrance' };

export const v4: MotionVersion = {
  id: 'v4',
  label: 'Scene 1: the dots fade in on the dark (300ms)',
  model: FADE,
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: { field: { model: FADE, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }] } },
  interaction: {
    initial: 'dark',
    states: { dark: {}, light: {} },
    transitions: { dark: FADE, light: FADE },
  },
  forkedFrom: 'v3',
};

export default v4;
