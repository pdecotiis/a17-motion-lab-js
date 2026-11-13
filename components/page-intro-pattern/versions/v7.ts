import type { MotionVersion } from '../../../lab/lib/types.js';

// v5: the opening's pattern. The page is in the dark (near-black, the colour of the buttons) and the dots fade in over 300ms. The page goes to white a beat after the three colour cards are in: it starts at 1140ms and takes
// 400ms on expressive-entrance (it is done at 1500ms; a beat later the header, the logo's wordmark and the sidebar come in). The change is the opacity of the 'lights' element going from 1 (dark) to 0 (light): the pattern's runtime takes
// that opacity as how dark the page is, so the black behind, the dots' two palettes and the page-coloured edge all change together, at a time of its own (from the start of the opening), not counted from the end of this entrance.
const FADE = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-entrance' };

export const v7: MotionVersion = {
  id: 'v7',
  label: 'Opening v13: dots fade in on the dark, the page goes to white as the title finishes',
  model: FADE,
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    field: { model: FADE, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }] },
    lights: {
      model: { model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.1140' },
      keyframes: [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 1 }],
    },
  },
  // the component is in its 'dark' state throughout: it is what has the pattern start in the dark, before the lights element is animating
  interaction: { initial: 'dark', states: { dark: {}, white: {} }, transitions: { dark: FADE, white: FADE } },
  forkedFrom: 'v5',
};

export default v7;
