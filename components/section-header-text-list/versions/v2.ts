import type { MotionVersion } from '../../../lab/lib/types.js';

// Layered: the section settles in, then its parts follow one another (eyebrow, title, text, media) with the
// entrance presets. Plays once, when the section scrolls into view.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Layered',
  entrance: { preset: 'button' },
  layers: {
    'eyebrow': { preset: 'text', delay: 'delay.40' },
    'title': { preset: 'text', delay: 'delay.70' },
    'block-1': { preset: 'text', delay: 'delay.120' },
    'block-2': { preset: 'text', delay: 'duration.140' },
    'block-3': { preset: 'text', delay: 'duration.220' },
    'block-4': { preset: 'text', delay: 'duration.220' },
    'media': { preset: 'media', delay: 'delay.120' },
  },
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v1',
};

export default v2;
