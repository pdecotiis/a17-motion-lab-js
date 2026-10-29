import type { MotionVersion } from '../../../lab/lib/types.js';

// Default entrance scaffolded by the Figma import. Edit freely: re-imports never touch this file.
export const v1: MotionVersion = {
  id: 'v1',
  label: 'Default Entrance',
  model: {
    model: 'tween',
    duration: 'motion.timings.slow',
    easing: 'motion.easings.ease-out',
    delay: '0ms',
  },
  keyframes: [
    { opacity: 0, transform: 'translateY(16px)', offset: 0 }, // motion.distances.md
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  status: 'in-progress',
  lineage: "imported from https://www.figma.com/design/HuYFjaWLJq5X1UHQw2z63w/Jane-Street-%E2%80%94-Website-%C2%B7-Design-Implementation-WIP?node-id=22711-54958",
};

export default v1;
