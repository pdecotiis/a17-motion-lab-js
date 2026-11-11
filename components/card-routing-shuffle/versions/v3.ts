import type { MotionVersion } from '../../../lab/lib/types.js';
import { STATE_ORDER } from '../layouts.js';

// v3: the bento as the page's design has it (the page layout, still), and nothing else: the cards come in one after another with the card preset, in reading
// order, and then it waits. As the page scrolls the middle picture grows to fill the page's container and the cells around it collapse (the `scroll-expand` trigger in
// triggers/scroll-expand.ts), while the grid stays pinned. The Shuffle button and its timer are not part of this one (the trigger hides the button).
const each = <T>(f: (s: string) => T): Record<string, T> => Object.fromEntries(STATE_ORDER.map(s => [s, f(s)]));
const STILL = { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-standard' };

export const v3: MotionVersion = {
  id: 'v3',
  label: 'Cards in, then the middle picture grows to fill the container on scroll (the rest collapse)',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  // each card of the page layout, in reading order, with the card preset (a delay is a delay or duration token)
  layers: {
    y0: { preset: 'card' },
    p1a: { preset: 'card', delay: 'delay.40' },
    g2: { preset: 'card', delay: 'delay.70' },
    p0a: { preset: 'card', delay: 'delay.120' },
    i1: { preset: 'card', delay: 'duration.140' },
    p2a: { preset: 'card', delay: 'duration.220' },
  },
  elements: { y0: 'card', i1: 'card', g2: 'card' },
  interaction: {
    initial: 'default',
    states: each(() => ({})),
    transitions: each(() => STILL),
    triggers: [{ on: 'scroll-expand', cell: 'p1a' }],
  },
  forkedFrom: 'v1',
};

export default v3;
