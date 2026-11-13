import type { MotionVersion } from '../../../lab/lib/types.js';

// v6: the opening's title. White on the dark (the page's dark), it comes in a line at a time with the text preset (each line fades and rises 16px, 560ms on expressive-entrance), the second line one default stagger
// (this project's, the middle delay token: delay.40) after the first, starting 300ms in, after the logomark: the first line at 300ms, the second at 340ms, done at 900ms. Then, as the page goes to white (from 1140ms, over 400ms
// on expressive-entrance, the same as the pattern's), the title goes from white to the page's text colour so it can be read on the white. Both are fixed times from the start of the opening, not counted from the end of the entrance.
const LIGHTS = { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.1140' };

export const v8: MotionVersion = {
  id: 'v8',
  label: 'Opening v13: title line by line, white on the dark, then dark on the white at 1140ms',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    line: { preset: 'text', delay: 'duration.300', stagger: 'delay.40' },
    title: { model: LIGHTS, keyframes: [{ color: 'var(--text-inverse)', offset: 0 }, { color: 'var(--text-default)', offset: 1 }] },
  },
  forkedFrom: 'v6',
};

export default v8;
