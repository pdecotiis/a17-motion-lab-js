import type { MotionVersion } from '../../../lab/lib/types.js';

// Morph with physicality: the cells share the grid, so when one grows the others give up the space, and a cell can
// shrink to nothing. The grid is 4 columns x 2 rows (238 x 296px, 8px gaps); each state sets the track sizes, nothing else moves.
// Beyond the Figma layout every cell is a half or a third of its row or column (nothing smaller: it feels too small). Row 1 is the
// orange cell, the first photo and the second photo; row 2 is the third photo and the lilac card. States (the buttons reach all of
// them, a click toggles default <-> two-thirds):
//   two-thirds   orange 2/3, first photo 1/3, second photo closes; third photo 2/3, lilac 1/3
//   half-left    orange 1/2, second photo 1/2, first photo closes; third photo 1/2, lilac 1/2
//   half-right   the same halves, the other column closes (first photo 1/2, second closes)
//   third-left   orange 1/3, second photo 2/3, first photo closes; third photo 1/3, lilac 2/3
//   thirds       orange, first and second photo 1/3 each; third photo 1/3, lilac 2/3
//   top, bottom  the top row 2/3 and the bottom row 1/3, and the other way round
//   tall         the bottom row closes: the top row fills the height
//   mix          thirds and top together; mix-2 two-thirds and bottom
// (Experiment: grid-template-*, column-gap and margin in a state.)

const px = (...n: number[]) => n.map(v => `${v}px`).join(' ');
const ROW_SUM = 592; // 600 minus one 8px gap
const DEFAULT = { cols: [238, 238, 238, 238], rows: [296, 296] };

// closes: which column closes (c3: the first photo's, c4: the second photo's), see below.
interface Layout { cols: number[]; rows: number[]; closes?: 'c3' | 'c4' }
const LAYOUTS: Record<string, Layout> = {
  default: DEFAULT,
  'two-thirds': { cols: [320, 320, 312, 0], rows: [296, 296], closes: 'c4' },
  'half-left': { cols: [240, 240, 0, 484], rows: [296, 296], closes: 'c3' },
  'half-right': { cols: [238, 238, 476, 0], rows: [296, 296], closes: 'c4' },
  'third-left': { cols: [158, 158, 0, 648], rows: [296, 296], closes: 'c3' },
  thirds: { cols: [156, 156, 320, 320], rows: [296, 296] },
  top: { cols: [238, 238, 238, 238], rows: [395, 197] },
  bottom: { cols: [238, 238, 238, 238], rows: [197, 395] },
  tall: { cols: [238, 238, 238, 238], rows: [592, 0] },
  mix: { cols: [156, 156, 320, 320], rows: [395, 197] },
  'mix-2': { cols: [320, 320, 312, 0], rows: [197, 395], closes: 'c4' },
};
// The columns plus the gaps (8px, or 4px with the third column closed) must fill the grid's 976px.
for (const [name, l] of Object.entries(LAYOUTS)) {
  const gaps = l.closes === 'c3' ? 12 : 24;
  if (l.cols.reduce((a, b) => a + b, 0) + gaps !== 976) throw new Error(`${name}: columns must fill 976px`);
  if (l.rows.reduce((a, b) => a + b, 0) !== ROW_SUM) throw new Error(`${name}: rows must add up to ${ROW_SUM}`);
}

// A closed column leaves its two 8px gaps. With the third column closed the column gap shrinks 8 -> 4px and the cells beside it give back
// what it loses (the closing photo keeps 8px from both neighbours, the lilac card from the third photo). With the last column closed the
// first photo and the lilac card reach over its gap. Either way every gutter stays 8px.
const names = Object.keys(LAYOUTS);
const gap = (l: Layout) => (l.closes === 'c3' ? '4px' : '8px');
const image1 = (l: Layout) => (l.closes === 'c3' ? { marginLeft: '4px', marginRight: '4px' } : l.closes === 'c4' ? { marginLeft: '0px', marginRight: '-8px' } : { marginLeft: '0px', marginRight: '0px' });
const tile2 = (l: Layout) => ({ marginLeft: l.closes === 'c3' ? '4px' : '0px' });
const per = <T>(f: (l: Layout) => T) => Object.fromEntries(names.map(n => [n, f(LAYOUTS[n]!)]));
const timing = (n: string) => n === 'default'
  ? ({ model: 'tween', duration: 'duration.400', easing: 'easing.expressive-exit' } as const)
  : ({ model: 'tween', duration: 'duration.800', easing: 'easing.expressive-standard' } as const);

export const v2: MotionVersion = {
  id: 'v2',
  label: 'Morph: cells share the space',
  interaction: {
    initial: 'default',
    states: Object.fromEntries(names.map(n => [n, {}])),
    transitions: Object.fromEntries(names.map(n => [n, timing(n)])),
    layers: {
      'image-1': { states: per(image1) },
      'tile-2': { states: per(tile2) },
      grid: { states: per(l => ({ gridTemplateColumns: px(...l.cols), gridTemplateRows: px(...l.rows), columnGap: gap(l) })) },
    },
    triggers: [{ on: 'click', toggle: ['default', 'two-thirds'] }],
  },
  forkedFrom: 'v1',
};

export default v2;
