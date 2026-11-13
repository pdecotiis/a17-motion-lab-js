import type { MotionVersion } from '../../../lab/lib/types.js';
import { v8 } from './v8.js';
import { v11 } from './v11.js';

// v12: v10's bento (fixed columns, four arrangements, v11's opening, no two colour cards of one colour in an arrangement: the Technology card of the second and fourth arrangements is green) with the full pagination: the arrows and the
// play / pause button at the left and the black sticky pill of bullets, coming in 235ms after the pictures start to open, 15ms apart (v11's). The bento cycles every five seconds, the arrows and the bullets go where they say, the play /
// pause button stops and starts the loop, and a hover on a colour card pauses it.
const i8 = v8.interaction!, i11 = v11.interaction!;
const GREEN = 'var(--background-accent-2)', ON_GREEN = 'var(--text-on-accent-2)';
// every state of a layer keeps its own values, plus the extra ones
const withExtra = (name: string, extra: Record<string, string>) => {
  const layer = i8.layers![name]!;
  return { ...layer, states: Object.fromEntries(Object.entries(layer.states).map(([s, v]) => [s, { ...v, ...extra }])) };
};
const { pager: _pager, ...baseLayers } = i8.layers!;
const layers = {
  ...baseLayers,
  // the controls come in one after another (v11's staggered entrance: the arrows, the play / pause button, then the bullets)
  'pg-prev': i11.layers!['pg-prev']!,
  'pg-next': i11.layers!['pg-next']!,
  'pg-playpause': i11.layers!['pg-playpause']!,
  float: i11.layers!['float']!,
  y2: withExtra('y2', { backgroundColor: GREEN }),
  'title-y2': withExtra('title-y2', { color: ON_GREEN }),
  'arrow-y2': withExtra('arrow-y2', { filter: 'invert(1)' }),   // the yellow card's dark arrow becomes a light one on the green
};

export const v12: MotionVersion = {
  ...v8,
  id: 'v12',
  label: 'Fixed columns with the pagination: arrows, play / pause and bullets; no two cards of one colour',
  model: v11.model,
  layers: v11.layers,
  interaction: { ...i8, hold: i11.hold, layers },
  forkedFrom: 'v10',
};

export default v12;
