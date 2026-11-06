import type { MotionVersion } from '../../../lab/lib/types.js';

// Layered: the section settles in, then its parts follow one another (eyebrow, title, text, media) with the
// entrance presets. Plays once, when the section scrolls into view.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Layered',
  entrance: { preset: 'ui' },
  layers: {
    'card': { preset: 'card', delay: 'delay.40' },
    'eyebrow': { preset: 'eyebrow', delay: 'delay.80' },
    'title': { preset: 'title', delay: 'delay.120' },
    'prompt-1': { preset: 'ui', delay: 'duration.150' },
    'prompt-2': { preset: 'ui', delay: 'duration.200' },
    'prompt-3': { preset: 'ui', delay: 'duration.250' },
    'prompt-4': { preset: 'ui', delay: 'duration.400' },
    'prompt-5': { preset: 'ui', delay: 'duration.700' },
  },
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v1',
};

export default v2;
