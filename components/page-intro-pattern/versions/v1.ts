import type { MotionVersion } from '../../../lab/lib/types.js';

// v1: the pattern shows for 2.5 seconds as the page opens, then fades away while the page's sections fade in (the page's own `hold` is the same 2500ms, so the
// sections start as this one leaves). It has no entrance of its own: it is there from the first frame, and its first move is the fade.
const FADE = { model: 'tween' as const, duration: 'duration.800', easing: 'easing.expressive-exit' };

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Shows, then fades away',
  interaction: {
    initial: 'shown',
    hold: '2500ms',
    states: { shown: { opacity: 1 }, hidden: { opacity: 0 } },
    transitions: { shown: FADE, hidden: FADE },
  },
  lineage: 'new, from the dotted background image supplied by the designer',
};

export default v1;
