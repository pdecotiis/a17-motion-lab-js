import type { MotionVersion } from '../../../lab/lib/types.js';

// Default entrance scaffolded by the Figma import. Edit freely: re-imports never touch this file.
export const v1: MotionVersion = {
  id: 'v1',
  label: 'Default Entrance',
  model: {
    model: 'tween',
    duration: 'duration.400',
    easing: 'easing.expressive-entrance',
    delay: '0ms',
  },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.16})', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  lineage: "imported from https://www.figma.com/design/HuYFjaWLJq5X1UHQw2z63w/Jane-Street-%E2%80%94-Website-%C2%B7-Design-Implementation-WIP?node-id=23198-96558",
};

export default v1;
