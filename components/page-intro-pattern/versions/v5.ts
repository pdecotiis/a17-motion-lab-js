import type { MotionVersion } from '../../../lab/lib/types.js';
// Retimed: the idle part of the wait after the title is halved (the black to white starts 120ms after the title instead of 240, and the page elements 60ms after it instead of 120); comments below that give the earlier times are the earlier sequence.

// v5: the opening's pattern. The page is in the dark (near-black, the colour of the buttons) and the dots fade in over 300ms. The page goes to white a beat after the three colour cards are in: it starts at 1140ms and takes
// 400ms on expressive-entrance (it is done at 1700ms; a beat later the header, the logo's wordmark and the sidebar come in). The change is the opacity of the 'lights' element going from 1 (dark) to 0 (light): the pattern's runtime takes
// that opacity as how dark the page is, so the black behind, the dots' two palettes and the page-coloured edge all change together, at a time of its own (from the start of the opening), not counted from the end of this entrance.
const FADE = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-entrance' };

export const v5: MotionVersion = {
  id: 'v5',
  label: 'Opening: dots fade in on the dark, then the page goes to white',
  model: FADE,
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    field: { model: FADE, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }] },
    // the pattern clicks itself once as the title starts (300ms): a ring comes out of the middle of the page and spreads over the dots
    click: { model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'duration.300' }, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }] },
    lights: {
      model: { model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.1020' },
      keyframes: [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 1 }],
    },
  },
  // the component is in its 'dark' state throughout: it is what has the pattern start in the dark, before the lights element is animating
  interaction: { initial: 'dark', states: { dark: {}, white: {} }, transitions: { dark: FADE, white: FADE } },
  forkedFrom: 'v4',
};

export default v5;
