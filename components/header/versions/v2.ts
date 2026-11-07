import type { MotionVersion } from '../../../lab/lib/types.js';

// The header's two buttons, search and Join, come in with the button entrance preset (a small rise and fade, from the Figma presets
// frame), the second a beat after the first. The header itself only fades in, quickly, so the buttons are the motion.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Buttons with the button preset',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    search: { preset: 'button' },
    join: { preset: 'button', delay: 'delay.40' },
  },
  forkedFrom: 'v1',
};

export default v2;
