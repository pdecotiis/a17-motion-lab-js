import type { MotionVersion } from '../../../lab/lib/types.js';

// v3: the pattern lights up. The page opens in the dark (the colour of the buttons, near-black) with the dots, which fade in over 560ms, and the field runs agitated while it is dark. The logo's rings
// line up at 560ms (the menu's version does that), the dark holds for a beat, and at 800ms the lights come up: the state goes to 'light' (the sequence below), the field gets one click from the
// bottom middle of the page and an orange ring comes out of it, and over 800ms the page, the pattern and the dots go from dark to light as one thing (pattern/runtime.ts has the one number that
// does it: the black behind, the dots' two palettes and the page-coloured edge all follow it, so nothing is swapped and nothing white shows over the dark). The title, the bento, the navigation and the
// header wait for it (see the page version that uses it).
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Lights up: dots fade in on the dark, a beat, then an orange ring and the page lifts to light',
  model: { model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    field: {
      model: { model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance' },
      keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
    },
  },
  interaction: {
    initial: 'dark',
    states: { dark: {}, light: {} },
    transitions: { dark: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard' }, light: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard' } },
    triggers: [{ on: 'sequence', steps: [['light', '240ms']] }],   // 240ms after the dots have faded in (560ms): the lights come up at 800ms
  },
  forkedFrom: 'v2',
};

export default v3;
