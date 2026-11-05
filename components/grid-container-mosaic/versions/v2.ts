import type { MotionVersion } from '../../../lab/lib/types.js';

// Layered: the section settles in, then its parts follow one another (eyebrow, title, text, media) with the
// entrance presets. Plays once, when the section scrolls into view.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Layered',
  entrance: { preset: 'ui' },
  layers: {
    'image-1': { preset: 'media', delay: 'delay.40' },
    'image-2': { preset: 'media', delay: 'delay.70' },
    'image-3': { preset: 'media', delay: 'delay.120' },
    'image-4': { preset: 'media', delay: 'duration.140' },
    'image-5': { preset: 'media', delay: 'duration.220' },
    'image-6': { preset: 'media', delay: 'duration.300' },
  },
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v1',
};

export default v2;
