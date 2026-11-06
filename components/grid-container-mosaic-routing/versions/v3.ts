import type { MotionVersion } from '../../../lab/lib/types.js';

// Morph in: the section starts in the wide layout and the cells settle into the Figma layout, the orange cell shrinking back
// to two columns as the others move into place. The same geometry as v2 (see there), played once as an entrance. The
// section fades in over the first quarter second so nothing pops. The trigger is not specified yet.
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Morph in',
  model: { model: 'tween', duration: 'duration.220', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    'tile-1': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard' },
      keyframes: [{ transform: 'translate(123px, 0px) scale(1.5083, 1)', offset: 0 }, { transform: 'none', offset: 1 }],
    },
    'heading': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard' },
      keyframes: [{ transform: 'translateX(-81.55px) scaleX(0.663)', offset: 0 }, { transform: 'none', offset: 1 }],
    },
    'actions': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard' },
      keyframes: [{ transform: 'translateX(-44.15px) scaleX(0.663)', offset: 0 }, { transform: 'none', offset: 1 }],
    },
    'tile-2': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard' },
      keyframes: [{ transform: 'translate(123px, 0px) scale(0.4917, 1)', offset: 0 }, { transform: 'none', offset: 1 }],
    },
    'image-3': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard', delay: 'delay.40' },
      keyframes: [{ transform: 'translate(246px, 0px)', offset: 0 }, { transform: 'none', offset: 1 }],
    },
    'image-1': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard', delay: 'delay.40' },
      keyframes: [{ transform: 'translate(246px, 0px)', offset: 0 }, { transform: 'none', offset: 1 }],
    },
    'image-2': {
      model: { model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard', delay: 'delay.70' },
      keyframes: [{ transform: 'translate(-738px, 304px)', offset: 0 }, { transform: 'none', offset: 1 }],
    },
  },
  forkedFrom: 'v1',
};

export default v3;
