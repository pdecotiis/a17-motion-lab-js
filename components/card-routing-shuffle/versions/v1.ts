import type { MotionVersion } from '../../../lab/lib/types.js';
import { CELLS, LAYOUTS, STATE_ORDER, pixelsOf } from '../layouts.js';

// v1: a 3 x 3 bento that shuffles. Every cell is its own layer that moves (a translate) and resizes (width, height) to its place in the next arrangement;
// a cell that gets covered shrinks away in one dimension while its neighbour grows over it. The shuffle button below goes to the next arrangement on each
// click, and back to the first after the last. Colours only for now (the pictures and the video are placeholders).
const MOVE = { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-standard' };
// 'start' looks exactly like 'default': a version with only clicks plays its first move on load, and this way that move goes from the first arrangement to
// itself, so the bento opens on the first arrangement and waits for the button.
const ALL = ['start', ...STATE_ORDER];
const each = <T>(f: (s: string) => T): Record<string, T> => Object.fromEntries(ALL.map(s => [s, f(s)]));
const layoutOf = (s: string) => LAYOUTS[s === 'start' ? 'default' : s]!;

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const id of CELLS) {
  layers[id] = { states: each(s => pixelsOf(layoutOf(s), id)), transitions: each(() => MOVE) };
}

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Shuffle',
  interaction: {
    initial: 'start',
    states: each(() => ({})),
    transitions: each(() => MOVE),
    layers,
    triggers: [{ on: 'click', toggle: STATE_ORDER as [string, string, ...string[]], target: 'shuffle' }],
  },
  elements: { shuffle: 'button' },
  lineage: 'new, from the Figma "9 cell grid" frames (page home, xl · open)',
};

export default v1;
