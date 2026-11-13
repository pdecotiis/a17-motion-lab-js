import type { MotionVersion } from '../../../lab/lib/types.js';
import { PAIR_ORDER } from '../layouts-pairs.js';
import { v6 } from './v6.js';

// v9: v6 with the timing of the homepage opening of page version v13 (title, then the black page goes to white, then the header, the sidebar and the bento's colour cards come in 70ms apart, then the pictures open, then the
// pagination controls). The three colour cards come in with the card preset at 1960, 2030 and 2100ms (70ms apart, after the sidebar). The pictures open (the first move) as soon as the last card is in, and the pagination
// controls (the arrows and play / pause, the bullets and the shuffle button) come in after the pictures are done opening: 470ms after the move starts (the last column starts 70ms late and each column takes 400ms).
const FIRST = PAIR_ORDER[0] as string;
const i6 = v6.interaction!;
// the controls' transition into the first arrangement, 470ms after the move starts instead of 15ms
const later = (name: 'pager' | 'float') => ({
  ...i6.layers![name]!,
  transitions: { [FIRST]: { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.470' } },
});

export const v9: MotionVersion = {
  ...v6,
  id: 'v9',
  label: 'Opening: cards with the page, then the pictures open, then the controls',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'duration.1960' },
  layers: { o0: { preset: 'card', delay: 'duration.1960' }, y1: { preset: 'card', delay: 'duration.2030' }, g2: { preset: 'card', delay: 'duration.2100' } },
  interaction: { ...i6, hold: '0ms', layers: { ...i6.layers!, pager: later('pager'), float: later('float') } },
  forkedFrom: 'v6',
};

export default v9;
