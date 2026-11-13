import type { MotionVersion } from '../../../lab/lib/types.js';

// v7: the white opening's title. Dark on the white from the start, it comes in a line at a time with the text preset (the first line at 300ms, the second one default stagger later), as in v6; there is no colour change.

export const v7: MotionVersion = {
  id: 'v7',
  label: 'White opening: title line by line, dark on the white',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    line: { preset: 'text', delay: 'duration.300', stagger: 'delay.40' },
  },
  forkedFrom: 'v6',
};

export default v7;
