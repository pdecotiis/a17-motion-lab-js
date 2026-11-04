import type { MotionVersion } from '../../../lab/lib/types.js';

// The spring panel with its content following: the list and the buttons rise in after the panel, each
// a tween with its own delay. The panel overshoots under Motion; the content never does.
export const v1: MotionVersion = {
  id: 'v1',
  label: 'Spring, Content Follows',
  model: {
    model: 'spring',
    duration: 'duration.560',
    easing: 'easing.expressive-entrance',
    bounce: 'bounce.50',
    properties: [
      { property: 'transform', wrapTransform: 'translateX', unit: 'px', from: 48, to: 0 },
      { property: 'opacity', from: 0, to: 1 },
    ],
  },
  layers: {
    title: {
      model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance', delay: 'delay.70' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.8})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    list: {
      model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance', delay: 'delay.120' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.8})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
    actions: {
      model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance', delay: 'delay.120' },
      keyframes: [
        { opacity: 0, transform: 'translateY({distance.8})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ],
    },
  },
  trigger: { on: 'click' },
  lineage: 'kept from the earlier explorations (older versions removed)',
};

export default v1;
