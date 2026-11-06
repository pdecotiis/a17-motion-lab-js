import type { MotionVersion } from '../../../lab/lib/types.js';

// Layered: the section settles in, then its parts follow one another (eyebrow, title, text, media) with the
// entrance presets. Plays once, when the section scrolls into view.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Layered',
  entrance: { preset: 'button' },
  layers: {
    'card': { preset: 'card', delay: 'delay.40' },
    'eyebrow': { preset: 'text', delay: 'delay.70' },
    'title': { preset: 'text', delay: 'delay.120' },
    'prompt-1': { preset: 'button', delay: 'duration.140' },
    'prompt-2': { preset: 'button', delay: 'duration.220' },
    'prompt-3': { preset: 'button', delay: 'duration.220' },
    'prompt-4': { preset: 'button', delay: 'duration.400' },
    'prompt-5': { preset: 'button', delay: 'duration.800' },
  },
  trigger: { on: 'in-view', threshold: 0.2, once: true },
  forkedFrom: 'v1',
};

export default v2;
