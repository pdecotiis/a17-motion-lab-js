import type { MotionVersion, ComponentModule } from '../../lab/lib/types.js';

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Fade Up',
  model: {
    model: 'tween',
    duration: 'motion.timings.base',
    easing: 'motion.easings.ease-out',
    delay: '0ms',
  },
  keyframes: [
    { opacity: 0, transform: 'translateY(16px)', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  stagger: '80ms',
  status: 'in-progress',
};

export const v2: MotionVersion = {
  id: 'v2',
  label: 'Scale In',
  model: {
    model: 'spring',
    bounce: 0.4,
    duration: 'motion.springs.bouncy',
  },
  keyframes: [
    { opacity: 0, transform: 'scale(0.92)', offset: 0 },
    { opacity: 1, transform: 'scale(1)', offset: 1 },
  ],
  stagger: '100ms',
  status: 'in-progress',
};

export const defaultVersion = 'v1';
export const versions: MotionVersion[] = [v1, v2];

const cardModule: ComponentModule = { versions, defaultVersion };
export default cardModule;
