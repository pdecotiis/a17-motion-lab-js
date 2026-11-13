import type { MotionVersion } from '../../../lab/lib/types.js';
import { v5 } from './v5.js';
import { PAIR_ORDER } from '../layouts-pairs.js';

// v6: v5, for the page's opening. The bento is the next thing shown after the title: it starts 40ms after the title has finished coming in. The title (page-header-title v6) starts its lines at 300ms
// and 340ms, each rising for 560ms, so it is done at 900ms and the bento starts at 940ms: the grid fades in over 100ms and the three colour cards come in with the card preset (fade, rise and scale),
// 70ms apart (940, 1010 and 1080ms: experimental wait tokens, specific to this animation).
// Its sequence, v5's (the pictures open: the first move, then the arrows, the bullets and the five-second timer), starts when the page has finished going to white, at about 2740ms, with the header and the sidebar:
// the first move comes 1200ms after the cards have finished coming in (the entrance ends at about 1400ms), as v4 and v5 wait before their first move.
// The pictures' first move (into the first arrangement) has the timing of the rest of the opening's second phase: 400ms on expressive-entrance, like the header, the sidebar and the page going to white. The columns keep their
// small stagger (a delay token each, v4's); every other move of the bento (the arrows, the bullets, the timer) keeps v5's timing.
const FIRST = PAIR_ORDER[0] as string;
const quick = <T extends { model: string; duration?: string; easing?: string }>(t: T): T => ({ ...t, duration: 'duration.400', easing: 'easing.expressive-entrance' });
const i5 = v5.interaction!;
const firstMoveLayers = Object.fromEntries(Object.entries(i5.layers ?? {}).map(([name, layer]) => {
  const into = layer.transitions?.[FIRST];
  const isMove = into && 'duration' in into && into.duration === 'duration.400';
  return [name, isMove ? { ...layer, transitions: { ...layer.transitions, [FIRST]: quick(into) } } : layer];
}));

// The pagination controls (the arrows and play / pause, then the bullets and the shuffle button) come in with the first move, as the header's buttons do: they start hidden (scaled to 95%, 12px lower) and scale up,
// fade in and move up into place with that move's timing, a stagger (15ms) after it starts, so they arrive at the same moment as the header, the sidebar and the pictures.
const HIDDEN = { opacity: 0, transform: 'translateY({distance.12}) scale({scale.95})' };
const controls = Object.fromEntries(['pager', 'float'].map(name => [name, {
  states: Object.fromEntries(Object.keys(i5.states).map(state => [state, state === 'cards-only' ? HIDDEN : {}])),
  transitions: { [FIRST]: { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'delay.15' } },
}]));

export const v6: MotionVersion = {
  ...v5,
  id: 'v6',
  label: 'Opening: cards fade in 40ms after the title, sequence starts when the page is white',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'duration.560' },
  layers: { o0: { preset: 'card', delay: 'duration.560' }, y1: { preset: 'card', delay: 'duration.630' }, g2: { preset: 'card', delay: 'duration.700' } },
  interaction: { ...i5, hold: 'duration.300', transitions: { ...i5.transitions, [FIRST]: quick(i5.transitions![FIRST]!) }, layers: { ...firstMoveLayers, ...controls } },
  forkedFrom: 'v5',
};

export default v6;
