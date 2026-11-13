import type { MotionVersion } from '../../../lab/lib/types.js';
import { PAIR_ORDER } from '../layouts-pairs.js';
import { v6 } from './v6.js';
// v11: v9's opening with the page's elements coming in together with the page going to white (one movement): they start when the white starts, 120ms after the title, keeping their own small offsets; nothing waits for the white to finish.
// Retimed: the idle part of the wait after the title is halved (the black to white starts 120ms after the title instead of 240, and the page elements 60ms after it instead of 120); comments below that give the earlier times are the earlier sequence.

// v11: v6 with the timing of the homepage opening of page version v13 (title, then the black page goes to white, then the header, the sidebar and the bento's colour cards come in 70ms apart, then the pictures open, then the
// pagination controls). The three colour cards come in with the card preset at 1960, 2030 and 2100ms (70ms apart, after the sidebar). The pictures open (the first move) as soon as the last card is in, and the pagination
// controls (the arrows and play / pause, the bullets and the shuffle button) come in after the pictures are done opening: 470ms after the move starts (the last column starts 70ms late and each column takes 400ms).
const FIRST = PAIR_ORDER[0] as string;
const i6 = v6.interaction!;
// the controls' transition into the first arrangement, 235ms after the move starts (half of the 470ms it was: the pictures are still opening, as the morph bento's controls come in as its last part lands) instead of 15ms, and one after another 15ms apart: the arrows, the play / pause button, then the bullets (each fades in, scales up from
// 95% and rises 12px into place, 400ms on expressive-entrance). The arrows and the play / pause button are each in a span of their own (pg-prev, pg-next, pg-playpause) so their hover and press are not disturbed.
const after = (delay: string) => ({
  ...i6.layers!.pager!,
  transitions: { [FIRST]: { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-entrance', delay } },
});
const staggered = { 'pg-prev': after('duration.235'), 'pg-next': after('duration.250'), 'pg-playpause': after('duration.265'), float: { ...i6.layers!.float!, transitions: after('duration.280').transitions } };
const { pager: _pager, ...baseLayers } = i6.layers!;

export const v11: MotionVersion = {
  ...v6,
  id: 'v11',
  label: 'Opening: cards with the page going to white, then the pictures open, then the controls',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'duration.1160' },
  layers: { o0: { preset: 'card', delay: 'duration.1160' }, y1: { preset: 'card', delay: 'duration.1230' }, g2: { preset: 'card', delay: 'duration.1300' } },
  interaction: { ...i6, hold: '0ms', layers: { ...baseLayers, ...staggered } },
  forkedFrom: 'v9',
};

export default v11;
