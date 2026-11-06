import type { MotionVersion } from '../../../lab/lib/types.js';

// Layered: the section settles in, then its parts follow one another (eyebrow, title, text, media) with the
// entrance presets. Plays once, when the section scrolls into view.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Layered',
  entrance: { preset: 'ui' },
  layers: {
    'label-row': { preset: 'eyebrow', delay: 'delay.40' },
    'title': { preset: 'title', delay: 'delay.80' },
    'description': { preset: 'text', delay: 'delay.120' },
    'media': { preset: 'media', delay: 'duration.200' },
    'caption': { preset: 'text', delay: 'duration.250' },
  },
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v1',
};

export default v2;
