// Card routing slideshow: how big every part of the stage is in every state. Nothing slides: the stage is a stack, and the parts of it grow and collapse, so what is going away
// gives its room to what is coming (the way the shuffle's cells do).
//
// The stage is 1072 x 532. Top to bottom it is three bands: the intro's wide picture, the intro's three colour cards, and the slides. The slides band holds two columns (a
// left and a right half, 532 wide each), and each column is a stack of cells whose heights change: a card, a picture, or a row of two squares (a picture and a pattern).
// Three stories (trading, technology, machine learning) take two looks each: A (one big card next to a big picture) and B (the card squeezed to half height, with the
// picture and the pattern opening in the room it gave up).
//
// A cell's box is its visible height plus an 8px gutter below it, and the stylesheet clips the gutter off, so the gap between two cells is 8px all through a move: a cell that
// grows from nothing grows its gutter first and shows after it, never flush against its neighbour. The last cell's gutter is clipped off the bottom of the stage.

export type Group = 'intro' | 'trading' | 'technology' | 'machine-learning';
export type Look = 'cards' | 'image' | 'A' | 'B';
export type Size = 'full' | 'half' | 'none';

export const SLIDE_GROUPS: Group[] = ['trading', 'technology', 'machine-learning'];

/** A state's name, its group and its look. */
export const STATES: { id: string; group: Group; look: Look }[] = [
  { id: 'cards-only', group: 'intro', look: 'cards' },
  { id: 'intro-image', group: 'intro', look: 'image' },
  ...SLIDE_GROUPS.flatMap(group => (['A', 'B'] as const).map((look, i) => ({ id: `${group}-${i + 1}`, group, look }))),
];
/** The six slides, the ones the pagination steps through. */
export const SLIDES: string[] = STATES.filter(s => s.group !== 'intro').map(s => s.id);
export const INTRO_STATES = ['cards-only', 'intro-image'];

const stateOf = (id: string) => STATES.find(s => s.id === id)!;

/** The bands of the stage, from the top, and the height of each in each state: the picture and the colour cards of the intro (collapsed by the slides), and the slides. */
export const BANDS = ['band-image', 'band-cards', 'band-slides'] as const;
export const bandSize = (band: (typeof BANDS)[number], stateId: string): boolean => {
  const s = stateOf(stateId);
  if (band === 'band-slides') return s.group !== 'intro';
  if (band === 'band-image') return stateId === 'intro-image';
  return s.group === 'intro';
};

/**
 * The cells of the two columns, from the top of each column, and how big each is in each look of its story: a story's cells are collapsed in every state of the other stories.
 * `look` is the story's look: A has the card full height; B has it half height and the room it gave up filled by a row of two squares (above the card for trading, below it for the
 * others).
 */
export type Cell = { id: string; column: 'left' | 'right'; group: Group; sizes: Partial<Record<Look, Size>> };
export const CELLS: Cell[] = [
  { id: 't-row', column: 'left', group: 'trading', sizes: { B: 'half' } },
  { id: 't-card', column: 'left', group: 'trading', sizes: { A: 'full', B: 'half' } },
  { id: 'e-large', column: 'left', group: 'technology', sizes: { A: 'full', B: 'full' } },
  { id: 'm-card', column: 'left', group: 'machine-learning', sizes: { A: 'full', B: 'half' } },
  { id: 'm-row', column: 'left', group: 'machine-learning', sizes: { B: 'half' } },
  { id: 't-large', column: 'right', group: 'trading', sizes: { A: 'full', B: 'full' } },
  { id: 'e-card', column: 'right', group: 'technology', sizes: { A: 'full', B: 'half' } },
  { id: 'e-row', column: 'right', group: 'technology', sizes: { B: 'half' } },
  { id: 'm-large', column: 'right', group: 'machine-learning', sizes: { A: 'full', B: 'full' } },
];

/** How big a cell is in a state. */
export function sizeOf(cell: Cell, stateId: string): Size {
  const s = stateOf(stateId);
  return s.group === cell.group ? (cell.sizes[s.look] ?? 'none') : 'none';
}

/** The colour cards that have both contents (the big card's and the small card's), the group each belongs to, and the look each content shows in. */
export const FEATURE_CARDS = ['t-card', 'e-card', 'm-card'];
export const groupOfCard = (id: string): Group => CELLS.find(c => c.id === id)!.group;
/** The look a story has in a state, or undefined when it is not up. */
export const lookOf = (group: Group, stateId: string): Look | undefined => (stateOf(stateId).group === group ? stateOf(stateId).look : undefined);

// A cell's box is its visible height plus the 8px gutter (see above). Visible: a column is 100cqh tall (the stage's height); a half is half of it less half the gap between the two.
const BOX: Record<Size, string> = { full: 'calc(100cqh + 8px)', half: 'calc(50cqh + 4px)', none: 'calc(0cqh + 0px)' };
/** The height a cell has in a state, as the property a state sets. */
export const cellStyleOf = (cell: Cell, stateId: string): { height: string } => ({ height: BOX[sizeOf(cell, stateId)] });

// the bands: the intro's picture is 352 of the stage's 532 tall, its cards 172
const BAND_BOX = { 'band-image': 'calc(66.1654cqh + 8px)', 'band-cards': 'calc(32.3308cqh + 8px)', 'band-slides': 'calc(100cqh + 8px)' } as const;
export const bandStyleOf = (band: (typeof BANDS)[number], stateId: string): { height: string } => ({ height: bandSize(band, stateId) ? BAND_BOX[band] : 'calc(0cqh + 0px)' });
