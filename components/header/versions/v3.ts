import type { MotionVersion } from '../../../lab/lib/types.js';

// v2's entrance, plus the search button responds to the pointer by the button preset (hover tint, press scale, release): the preset's states are
// the project's own (tokens/presets.json), shared by every button. The Join button has none here.
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Search button: button preset',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    search: { preset: 'button' },
    join: { preset: 'button', delay: 'delay.40' },
  },
  elements: { search: 'button' },
  forkedFrom: 'v2',
};

export default v3;
