import type { MotionVersion } from '../../../lab/lib/types.js';

// The card rises and fades in, and its text follows: the title and the description each
// rise a little and fade in, a beat after the card. A layer is the element marked data-motion in
// markup.html, and it names its own tokens, so the text moves differently from the card.
export const v1: MotionVersion = {
  id: 'v1',
  label: 'Fade Up, Text Follows',
  model: {
    model: 'tween',
    duration: 'duration.220',
    easing: 'easing.productive-entrance',
    delay: '0ms',
  },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.16})', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  layers: {
    title: {
      model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance', delay: 'delay.70' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.8})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    text: {
      model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance', delay: 'delay.120' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.8})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
  },
  stagger: 'delay.70',
  lineage: 'kept from the earlier explorations (older versions removed)',
};

export default v1;
