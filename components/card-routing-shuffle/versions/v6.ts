import type { MotionVersion } from '../../../lab/lib/types.js';
import { v5 } from './v5.js';

// v6: v5, for the page's opening. The bento is the next thing shown after the title: it starts 40ms after the title has finished coming in. The title (page-header-title v6) starts its lines at 300ms
// and 340ms, each rising for 560ms, so it is done at 900ms and the bento starts at 940ms: the grid fades in over 100ms and the three colour cards come in with the card preset (fade, rise and scale),
// 70ms apart (940, 1010 and 1080ms: experimental wait tokens, specific to this animation).
// Its sequence, v5's (the pictures open: the first move, then the arrows, the bullets and the five-second timer), starts when the page has finished going to white, at about 2740ms, with the header and the sidebar:
// the first move comes 1200ms after the cards have finished coming in (the entrance ends at about 1400ms), as v4 and v5 wait before their first move.
export const v6: MotionVersion = {
  ...v5,
  id: 'v6',
  label: 'Opening: cards fade in 40ms after the title, sequence starts when the page is white',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'duration.560' },
  layers: { o0: { preset: 'card', delay: 'duration.560' }, y1: { preset: 'card', delay: 'duration.630' }, g2: { preset: 'card', delay: 'duration.700' } },
  interaction: { ...v5.interaction!, hold: 'duration.1080' },
  forkedFrom: 'v5',
};

export default v6;
