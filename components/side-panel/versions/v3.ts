import type { MotionVersion } from '../../../lab/lib/types.js';
import { v2 } from './v2.js';

// The spring panel with its content following: the list and the buttons rise in after the panel, each
// a tween with its own delay. The panel overshoots under Motion; the content never does.
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Spring, Content Follows',
  model: v2.model,
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
  status: 'in-progress',
  forkedFrom: 'v2',
};

export default v3;
