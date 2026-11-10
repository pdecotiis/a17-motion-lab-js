import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v4: a four-by-two bento (four colour cards, four pictures) that rearranges differently each time you click, even on the same picture. The columns trade
// width: each picture cycles through three arrangements of its own, then back to four equal columns: WIDE (that column 400 against three of 216), PAIR (it and
// its neighbour 308 each, the other two 216) and STAGGER (330, 266, 226, 226, the widest at the clicked column and narrowing away from it). A card
// brings the equal columns back. The pictures are 262 tall in every arrangement, so the bento is the same height (505: a 235 card, 8, a 262 picture)
// however the columns share the width. Every colour card is in every arrangement (the narrowest column, 216, still fits its title).
// It opens as v2 and v3 do: the cards cascade in, a quick beat, the pictures are masked in.
const FOCUS = [1, 2, 3, 4] as const;
const SHAPES = ['wide', 'pair', 'stagger'] as const;
type Shape = typeof SHAPES[number];
const STATES: string[] = ['cards', 'default', ...FOCUS.flatMap(f => SHAPES.map(s => `f${f}-${s}`))];
const GROW = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const each = <T>(f: (s: string) => T): Record<string, T> => Object.fromEntries(STATES.map(s => [s, f(s)]));

// Column widths for the picture focus `f` (1-based) in a shape: 1048 between the three 8px gaps.
function widths(f: number, shape: Shape): number[] {
  const out = [216, 216, 216, 216];
  const at = (k: number) => ((k - 1 + 4) % 4);
  if (shape === 'wide') out[at(f)] = 400;
  else if (shape === 'pair') { out[at(f)] = 308; out[at(f + 1)] = 308; }
  else { out[at(f)] = 330; out[at(f + 1)] = 266; out[at(f + 2)] = 226; out[at(f + 3)] = 226; }
  return out;
}
const columnsOf = (state: string): string => {
  const m = /^f(\d)-(wide|pair|stagger)$/.exec(state);
  const w = m ? widths(Number(m[1]), m[2] as Shape) : [262, 262, 262, 262];
  return w.map(x => `${x}px`).join(' ');
};
const imageHeight = (state: string): string => (state === 'cards' ? '0px' : '262px');

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {
  grid: { states: each(s => ({ gridTemplateColumns: columnsOf(s) })), transitions: each(() => GROW) },
  // the fourth column has the width of its track
  'col-4': { states: each(() => ({ width: '100%' })) },
};
for (const col of ['col-1', 'col-2', 'col-3', 'col-4']) layers[col] = { ...(layers[col] ?? { states: each(() => ({})) }), states: { ...(layers[col]?.states ?? each(() => ({}))), ...each(s => ({ ...(col === 'col-4' ? { width: '100%' } : {}), rowGap: s === 'cards' ? '0px' : '8px' })) }, transitions: each(() => GROW) };
const DELAYS: (string | undefined)[] = [undefined, 'delay.40', 'delay.70', 'delay.120'];
FOCUS.forEach((f, k) => {
  const delay = DELAYS[k];
  layers[`image-${f}`] = { states: each(s => ({ height: imageHeight(s) })), transitions: each(s => (s === 'default' && delay ? { ...GROW, delay } : GROW)) };
  layers[`photo-${f}`] = { states: each(() => ({ height: '100%' })) };
});

export const v4: MotionVersion = {
  ...v1,
  id: 'v4',
  label: 'Four by two, a new arrangement each click',
  layers: {
    'card-1': { preset: 'card' },
    'card-2': { preset: 'card', delay: 'delay.70' },
    'card-3': { preset: 'card', delay: 'delay.120' },
    'card-4': { preset: 'card', delay: 'duration.140' },
  },
  elements: { 'card-1': 'card', 'card-2': 'card', 'card-3': 'card', 'card-4': 'card' },
  interaction: {
    initial: 'cards',
    hold: 'duration.300',
    states: each(() => ({})),
    transitions: each(() => GROW),
    layers,
    triggers: [
      // each picture cycles through its three arrangements and then the equal columns, a click at a time
      ...FOCUS.map(f => ({ on: 'click' as const, toggle: [`f${f}-wide`, `f${f}-pair`, `f${f}-stagger`, 'default'] as [string, string, ...string[]], target: `image-${f}` })),
      ...FOCUS.map(f => ({ on: 'click' as const, set: 'default', target: `card-${f}` })),
    ],
  },
  forkedFrom: 'v3',
};
delete (v4 as { lineage?: string }).lineage;

export default v4;
