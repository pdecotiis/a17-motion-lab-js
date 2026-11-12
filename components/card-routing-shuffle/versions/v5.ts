import type { MotionVersion } from '../../../lab/lib/types.js';
import { PAIR_ORDER } from '../layouts-pairs.js';
import { v4 } from './v4.js';

// v5: v4's bento (the same four arrangements, the cards going round) with the pagination of the page's design (Figma "button block"): arrows and a play / pause button on the
// left, and on the right a pill of four bullets, one for each arrangement. The larger bullet fills over the five seconds of its arrangement (the CSS animation on the root's
// data-state, the same five seconds as the timer), then the bento goes to the next arrangement, the bullet shrinks and the next one grows and fills. A bullet is a button: a
// click goes to its arrangement. Hovering a colour card holds them too. The pause button stops the timer and the fill together, and resuming carries on with what was left. The arrows step through the arrangements,
// round and round. There is no shuffle button here: the pagination is the control.
// hovering a colour card holds the timer and the fill (they carry on with what was left)
const CARDS = ['o0', 'g0', 'y0', 'y0b', 'i0', 'o1', 'g1', 'y1', 'i1', 'o2', 'g2', 'i2', 'y2'];
const ORDER = PAIR_ORDER as [string, string, ...string[]];

export const v5: MotionVersion = {
  ...v4,
  id: 'v5',
  label: 'Pagination: bullets that fill, arrows and play / pause',
  interaction: {
    ...v4.interaction!,
    triggers: [
      { on: 'click', toggle: ORDER, target: 'next' },
      { on: 'click', toggle: [...ORDER].reverse() as [string, string, ...string[]], target: 'prev' },
      ...ORDER.map((state, i) => ({ on: 'click' as const, set: state, target: `dot-${i + 1}` })),
      // and by itself: five seconds after the last change, unless paused (the fill on the bullet takes the same five seconds: keep them equal)
      { on: 'interval', every: '5000ms', toggle: ORDER, pause: 'playpause', pauseOnHover: CARDS },
    ],
  },
  forkedFrom: 'v4',
};

export default v5;
