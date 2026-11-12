import type { MotionVersion } from '../../../lab/lib/types.js';
import { CELLS, LAYOUTS, STATE_ORDER, sizeOf } from '../layouts.js';
import { pictureStates } from '../pictures.js';

// v2: the homepage opening. The bento fills the window (it is as wide as the page gives it, in the proportions of the settled page), and each of the three scenes (the page layout, then two others) is shown in full for a
// second, the third as long as the first two, before the page settles around it (a change takes 220ms, so the changes come 1220ms apart): the menu slides in and the bento narrows to its place beside it
// (the menu and the page's own layout do that; the cells follow the width they are given), and the bento comes back to the page layout. The changes are fast: a
// 100ms fade in, then 220ms for each change of scene, on a clock the menu shares (the `sequence` trigger in triggers/sequence.ts). After the opening it
// behaves as v1 does: the Shuffle button goes to the next arrangement, and so does the timer.
const SCENE = { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-standard' };
const each = <T>(f: (s: string) => T): Record<string, T> => Object.fromEntries(STATE_ORDER.map(s => [s, f(s)]));

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const id of CELLS) layers[id] = { states: each(s => sizeOf(LAYOUTS[s]!, id)), transitions: each(() => SCENE) };
// the pictures: each arrangement shows its own (pictures.ts), so the pictures change each time the bento does
for (const [name, states] of Object.entries(pictureStates(STATE_ORDER))) layers[name] = { states, transitions: each(() => SCENE) };

export const v2: MotionVersion = {
  id: 'v2',
  label: 'Opening: three scenes, then the page settles',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  interaction: {
    initial: 'default',
    states: each(() => ({})),
    transitions: each(() => SCENE),
    layers,
    triggers: [
      // the pagination arrows under the bento: next goes to the next arrangement, previous to the one before (the same list the other way round)
      { on: 'click', toggle: STATE_ORDER as [string, string, ...string[]], target: 'next' },
      { on: 'click', toggle: [...STATE_ORDER].reverse() as [string, string, ...string[]], target: 'prev' },
      { on: 'click', toggle: STATE_ORDER as [string, string, ...string[]], target: 'shuffle' },
      // the opening: two scenes after the first, then back to the page layout as the page settles (times are from when the entrance has finished: each scene is
      // fully shown for 1000ms, and a change takes 220ms)
      { on: 'sequence', steps: [['layout-2', '1000ms'], ['layout-3', '2220ms'], ['default', '3440ms']] },
      // afterwards, the timer steps on by itself, as in v1 (the ring on the button fills over the same five seconds)
      { on: 'interval', every: '5000ms', toggle: STATE_ORDER as [string, string, ...string[]] },
    ],
  },
  elements: { shuffle: 'button', y0: 'card', i0: 'card', g1: 'card', i1: 'card', g2: 'card', y2: 'card' },
  forkedFrom: 'v1',
};

export default v2;
