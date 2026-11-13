import type { MotionVersion } from '../../../lab/lib/types.js';

// v5: v4 (the approved read-more block of the original Motion Lab) with the prompt rows' hover, the original's arrow swap ("prompt item arrow swap", as on its buttons): at rest the near-black arrow button sits at the left of the row and the text
// beside it; on hover that button slides out to the left, shrinks to 75% and fades, while a twin, the accent button with a dark arrow, slides in from the right growing from 75% and lands at the right end of the row, and the text
// moves left (48px: 64 to 16, its place in the Figma hover state). All on 300ms productive-entrance (the original's travel), and the row crops what is past its edge. Hover is live once the entrance has ended.
const STD = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const IN = [{ opacity: 0, transform: 'translateY({distance.24}) scale({scale.95})', offset: 0 }, { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }];
const TXT = [{ opacity: 0, transform: 'translateY({distance.24}) scale({scale.98})', offset: 0 }, { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }];
const ROW = [{ opacity: 0, transform: 'translateY({distance.24})', offset: 0 }, { opacity: 1, transform: 'translateY(0px)', offset: 1 }];
const at = (delay?: string) => ({ model: { ...STD, ...(delay ? { delay } : {}) } });

const HOVER = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-entrance' };
const ROWS = [1, 2, 3, 4, 5];
const STATES = ['default', ...ROWS.map(n => `hovered-${n}`)];
const timing = Object.fromEntries(STATES.map(s => [s, HOVER]));
// one part of row n: its values while that row is hovered, and at rest in every other state
const part = (name: string, on: Record<string, string>, rest: Record<string, string>, row: number) => [name, {
  states: Object.fromEntries(STATES.map(s => [s, s === `hovered-${row}` ? on : rest])),
  transitions: timing,
}] as const;
const AWAY = { opacity: '0', transform: 'translateX(-{distance.40}) scale({scale.75})' };    // the near-black button, out to the left
const HERE = { opacity: '1', transform: 'translateX(0px) scale(1)' };
const WAITING = { opacity: '0', transform: 'translateX({distance.40}) scale({scale.75})' };    // the twin, waiting past the right end
const hoverLayers = Object.fromEntries(ROWS.flatMap(n => [
  part(`btn-${n}`, AWAY, HERE, n),
  part(`twin-${n}`, HERE, WAITING, n),
  part(`text-${n}`, { transform: 'translateX(-48px)' }, { transform: 'translateX(0px)' }, n),
]));

export const v5: MotionVersion = {
  id: 'v5',
  label: 'Read-more block with row hover: the arrow button swaps out left, the accent one in from the right',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    card: { ...at(), keyframes: IN },
    eyebrow: { ...at('delay.120'), keyframes: TXT },
    label: { model: { model: 'tween', duration: 'duration.440', easing: 'easing.linear', delay: 'delay.120' }, keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }] },
    title: { ...at('delay.120'), keyframes: TXT },
    'prompt-1': { ...at('duration.240'), keyframes: ROW },
    'prompt-2': { ...at('duration.360'), keyframes: ROW },
    'prompt-3': { ...at('duration.480'), keyframes: ROW },
    'prompt-4': { ...at('duration.600'), keyframes: ROW },
    'prompt-5': { ...at('duration.720'), keyframes: ROW },
  },
  interaction: {
    initial: 'default',
    states: Object.fromEntries(STATES.map(s => [s, {}])),
    transitions: timing,
    layers: hoverLayers,
    triggers: ROWS.map(n => ({ on: 'hover' as const, state: `hovered-${n}`, target: `prompt-${n}` })),
  },
  trigger: { on: 'in-view', threshold: 0.3425, once: true },
  forkedFrom: 'v4',
};

export default v5;
