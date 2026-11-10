import type { MotionVersion } from '../../../lab/lib/types.js';
import { v1 } from './v1.js';

// v2: the bento's cells expand and collapse. The grid has three groups of two rows (rows 1-2, 3-4, 5-6: a colour card, a big picture and a small
// picture each). One group is expanded at a time and the others give way: its rows grow and the other four shrink, and its big picture's side of the
// grid widens at the expense of the card's column, so the cells morph from one arrangement to the next. The pictures fill their cells and scale with them.
// States: default (the Figma layout) and top, middle, bottom (the group that is open). For now they are played with the state buttons (and Replay); a
// timer that steps through them on an interval comes next. The entrance is v1's.
type State = 'default' | 'top' | 'middle' | 'bottom';
const STATES: State[] = ['default', 'top', 'middle', 'bottom'];

// Rows: 1364px between the gaps (6 x 227.33 by default); the open group's two rows are 300 each and the other four 191 each, so the height never changes.
const OPEN = '300px', SHUT = '191px';
const ROWS: Record<State, string> = {
  default: 'repeat(6, 227.333px)',
  top: `${OPEN} ${OPEN} ${SHUT} ${SHUT} ${SHUT} ${SHUT}`,
  middle: `${SHUT} ${SHUT} ${OPEN} ${OPEN} ${SHUT} ${SHUT}`,
  bottom: `${SHUT} ${SHUT} ${SHUT} ${SHUT} ${OPEN} ${OPEN}`,
};
// Columns (1072 between the gaps): the groups at the top and bottom have their card at the left and the big picture over the other two columns; the
// middle group has them the other way round. The open group's big picture widens (400 + 400) and its card narrows (256).
const COLUMNS: Record<State, string> = {
  default: 'repeat(3, 352px)',
  top: '256px 400px 400px',
  middle: '400px 400px 256px',
  bottom: '256px 400px 400px',
};

const MORPH = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
const each = <T>(f: (s: State) => T): Record<string, T> => Object.fromEntries(STATES.map(s => [s, f(s)]));

export const v2: MotionVersion = {
  id: 'v2',
  label: 'Cells expand and collapse',
  model: v1.model,
  keyframes: v1.keyframes,
  // The three colour cards respond to the pointer by the card preset (a tint on hover, a slight scale on press, released a little slower), apart from the
  // grid's own states: the cards' size follows the grid, and the preset only moves their tint and scale.
  elements: { 'cell-1': 'card', 'cell-5': 'card', 'cell-7': 'card' },
  interaction: {
    initial: 'default',
    states: each(() => ({})),
    transitions: each(() => MORPH),
    layers: {
      grid: { states: each(s => ({ gridTemplateColumns: COLUMNS[s], gridTemplateRows: ROWS[s] })), transitions: each(() => MORPH) },
    },
  },
  forkedFrom: 'v1',
};

export default v2;
