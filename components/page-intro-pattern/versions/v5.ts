import type { MotionVersion } from '../../../lab/lib/types.js';

// v5: the opening's pattern. The page is in the dark (near-black, the colour of the buttons) and the dots fade in over 300ms.
// Then the page goes to white: at 1340ms, over 800ms on expressive-standard (it is done at 2140ms, when the header, the sidebar and the bento's sequence start). The change is the opacity of the
// 'lights' element going from 1 (dark) to 0 (light): the pattern's runtime takes that opacity as how dark the page is, so the black behind, the dots' two palettes and the page-coloured edge all change together, at a time of
// its own (from the start of the opening), not counted from the end of this entrance. 1340ms is the unlocking of the logomark's rings (900 to 1340ms) and a beat of 240ms.
const FADE = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-entrance' };

export const v5: MotionVersion = {
  id: 'v5',
  label: 'Opening: dots fade in on the dark, then the page goes to white',
  model: FADE,
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    field: { model: FADE, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }] },
    lights: {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard', delay: 'duration.1340' },
      keyframes: [{ opacity: 1, offset: 0 }, { opacity: 0, offset: 1 }],
    },
  },
  // the component is in its 'dark' state throughout: it is what has the pattern start in the dark, before the lights element is animating
  interaction: { initial: 'dark', states: { dark: {}, white: {} }, transitions: { dark: FADE, white: FADE } },
  forkedFrom: 'v4',
};

export default v5;
