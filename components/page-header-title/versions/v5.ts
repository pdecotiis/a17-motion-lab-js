import type { MotionVersion } from '../../../lab/lib/types.js';

// v5: the title comes in a line at a time, for a page whose lights come up at 800ms (pattern v3): each line fades and rises with the text preset, from 800ms, the second 120ms after the first.
export const v5: MotionVersion = {
  id: 'v5',
  label: 'Line by line as the lights come up (800ms in)',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: { line: { preset: 'text', delay: 'duration.800', stagger: 'delay.120' } },
  forkedFrom: 'v1',
};

export default v5;
