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
  lineage: 'imported from seed component (no import source)',
};

// Scale In uses the real spring engine (springKeyframes → WAAPI).
// 'scale' is spring-simulated; 'opacity' fades in linearly alongside it.
export const v2: MotionVersion = {
  id: 'v2',
  label: 'Scale In',
  model: {
    model: 'spring',
    bounce: 0.4,
    duration: 'motion.springs.bouncy',
    properties: [
      { property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1, span: 1, useSpring: true },
      { property: 'opacity', from: 0, to: 1, span: 1, useSpring: false },
    ],
  },
  stagger: '100ms',
  status: 'in-progress',
  forkedFrom: 'v1',
};

// Archived example: kept for history, hidden from the lab by default.
export const v3: MotionVersion = {
  id: 'v3',
  label: 'Slow Fade',
  model: {
    model: 'tween',
    duration: 'motion.timings.slow',
    easing: 'motion.easings.ease-out',
    delay: '0ms',
  },
  keyframes: [
    { opacity: 0, transform: 'translateY(8px)', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  stagger: '80ms',
  status: 'archived',
  forkedFrom: 'v1',
};

export const defaultVersion = 'v1';
export const versions: MotionVersion[] = [v1, v2, v3];

const cardModule: ComponentModule = { versions, defaultVersion };
export default cardModule;
