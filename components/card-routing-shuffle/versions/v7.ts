import type { MotionVersion } from '../../../lab/lib/types.js';
import { v9 } from './v9.js';
// Retimed: the page elements come in together, starting 120ms after the title (with the page going to white where there is one), as in page version v11.
// Retimed: the idle part of the wait after the title is halved (the page elements come in 370ms after the title instead of 740); comments below that give the earlier times are the earlier sequence.

// v7: the bento of the white opening (page version v12): v9's, with the cards at 1710, 1780 and 1850ms (70ms apart, 70ms after the header and the sidebar at 1640ms; there is no black to white before them). The pictures open as soon
// as the last card is in, and the pagination controls come in after the pictures are done opening (470ms after the move starts), as in v9.
export const v7: MotionVersion = {
  ...v9,
  id: 'v7',
  label: 'White opening: cards after the header and nav, then the pictures open, then the controls',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'duration.1160' },
  layers: { o0: { preset: 'card', delay: 'duration.1160' }, y1: { preset: 'card', delay: 'duration.1230' }, g2: { preset: 'card', delay: 'duration.1300' } },
  forkedFrom: 'v6',
};

export default v7;
