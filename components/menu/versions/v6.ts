import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// v6: v2, for a page that opens in the dark (the pattern's "lights up", pattern v3). The logo is there from the first frame and stays on top, white on the dark (the logo's own #141414 turned
// inside out), and it goes back to black over 800ms as the lights come up, at 800ms, with the pattern. The logomark's three rings turn: each spins a different way and a different amount and, at
// 560ms, comes to rest with the gaps in all three lined up at the bottom, as if the mark had been unlocked; they hold there for a beat (until 800ms: the pattern's click and the lights come up
// then), then each turns the rest of the way to where the logo has it (a whole number of turns from where it started, so there is nothing to snap back). The rows come in last, from 1600ms, as in v5.
// The rings use a linear easing and keyframes at 560 and 800 of the 1200ms. The gaps in the logo's rings are at about 290 (outer), 160 (middle) and 33 (inner) degrees, clockwise from 3 o'clock, and
// 90 is the bottom: the outer turns -200 to get there (and a turn more, backwards), the middle -70 (a turn forwards instead: +290) and the inner +57 (a turn backwards instead: -303, and one more).
const RING = (to: number, end: number) => ({
  model: { model: 'tween' as const, duration: 'duration.1200', easing: 'easing.linear' },
  keyframes: [{ transform: 'rotate(0deg)', offset: 0 }, { transform: `rotate(${to}deg)`, offset: 0.4667 }, { transform: `rotate(${to}deg)`, offset: 0.6667 }, { transform: `rotate(${end}deg)`, offset: 1 }],
});

export const v6: MotionVersion = {
  ...v2,
  id: 'v6',
  label: 'Logo unlocks on the dark, rows come in last',
  layers: {
    'logo-mark': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard', delay: 'duration.800' },
      keyframes: [{ filter: 'invert(1) brightness(1.2)', offset: 0 }, { filter: 'invert(0) brightness(1)', offset: 1 }],
    },
    'ring-outer': RING(-560, -720),
    'ring-mid': RING(290, 360),
    'ring-inner': RING(-663, -720),
    row: { preset: 'button', delay: 'duration.1600', stagger: 'delay.15' },
  },
  forkedFrom: 'v2',
};

export default v6;
