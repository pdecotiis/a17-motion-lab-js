import type { MotionVersion } from '../../../lab/lib/types.js';
import { v8 } from './v8.js';
import { v11 } from './v11.js';

// v10: v8 (fixed columns, two arrangements) with only the black sticky pill of bullets as its pagination: no arrows and no play / pause button, and the bar they sat in takes no room. The bento cycles on its own
// every five seconds, a bullet goes to its arrangement, and holding the pointer over a colour card still pauses it (the interval trigger's pauseOnHover); there is no play / pause button to pause it any other way.
// And no two colour cards of one arrangement share a colour: the Technology card of the second and fourth arrangements (the third column's, y2) was yellow like the Machine Learning one (y0b), so it is green here (the cell's colour, its title's
// colour and its arrow are states of the version, so the other versions are as they were); the first arrangement is orange, yellow, green and the second yellow, indigo, green... the Technology card is green in both.
const i8 = v8.interaction!;
const GREEN = 'var(--background-accent-2)', ON_GREEN = 'var(--text-on-accent-2)';
// every state of a layer keeps its own values, plus the extra ones
const withExtra = (name: string, extra: Record<string, string>) => {
  const layer = i8.layers![name]!;
  return { ...layer, states: Object.fromEntries(Object.entries(layer.states).map(([s, v]) => [s, { ...v, ...extra }])) };
};
const layers = { ...i8.layers! };
// the arrows and play / pause go (their entrance layer has nothing to move); the pill stays, with its two collapsed bullets, and comes in first
// (the pager itself is taken out below; the bar round it keeps its height, which is where the bullets let go of the window)
const states = Object.keys(i8.states);
const none = Object.fromEntries(states.map(s => [s, { height: '0px' }]));
layers['pager'] = { states: none };      // the arrows and play / pause: no height, and the stylesheet takes a part with no height out of the layout
const firstMove = Object.keys(i8.layers!['float']!.transitions!)[0]!;
layers['float'] = { ...i8.layers!['float']!, transitions: { [firstMove]: { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.235' } } };   // the pill, as in the other bentos
layers['y2'] = withExtra('y2', { backgroundColor: GREEN });
layers['title-y2'] = withExtra('title-y2', { color: ON_GREEN });
layers['arrow-y2'] = withExtra('arrow-y2', { filter: 'invert(1)' });   // the yellow card's dark arrow becomes a light one on the green

// the loop is the interval trigger of v8 (its play / pause button is in the hidden bar: the trigger needs it there to show the pill of bullets, and nothing clicks it), and a hover on a card pauses it; a click on a bullet goes to its arrangement (the arrows' clicks go with the arrows)
const triggers = i8.triggers!.filter(t => t.on === 'interval' || (t.on === 'click' && /^dot-/.test((t as { target?: string }).target ?? ''))) as NonNullable<MotionVersion['interaction']>['triggers'];
const { prev: _p, next: _n, playpause: _pp, ...elements } = (v8.elements ?? {}) as Record<string, string>;

export const v10: MotionVersion = {
  ...v8,
  id: 'v10',
  label: 'Fixed columns, black bullets only: it cycles by itself, a hover pauses it, no two cards of one colour',
  // the opening is v11's (what page version v11 plays, and now with the shorter wait after the title): its cards and the first move after them, not v6's that v8 inherits
  model: v11.model,
  layers: v11.layers,
  interaction: { ...i8, hold: v11.interaction!.hold, layers, triggers },
  elements,
  forkedFrom: 'v8',
};

export default v10;
