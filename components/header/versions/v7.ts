import type { MotionVersion } from '../../../lab/lib/types.js';
import { v4 } from './v4.js';
// Retimed: the page elements come in together, starting 120ms after the title (with the page going to white where there is one), as in page version v11.
// Retimed: the idle part of the wait after the title is halved (the black to white starts 120ms after the title instead of 240, and the page elements 60ms after it instead of 120); comments below that give the earlier times are the earlier sequence.

// v7: the header of the opening of page version v13. The page goes white first (2640 to 3040ms) and then, a beat later (1820ms), the page's elements come in one after another, 70ms apart: the header first, then the sidebar,
// then the bento's parts. The header bar does not move: its two buttons do, 15ms apart, with the card preset (they rise 24px, scale up from 95% and fade in).
export const v7: MotionVersion = {
  ...v4,
  id: 'v7',
  label: 'Opening v13: the buttons rise, scale and fade in first (1820ms)',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    search: { preset: 'card', delay: 'duration.1020' },
    join: { preset: 'card', delay: 'duration.1035' },
  },
  forkedFrom: 'v6',
};

export default v7;
