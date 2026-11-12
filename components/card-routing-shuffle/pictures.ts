import { COLUMNS, LAYOUTS, STATE_ORDER } from './layouts.js';

// The pictures. Every time the bento changes, its pictures change too: a cell does not keep its picture from one arrangement to the next, and a picture is never
// shown twice in one arrangement or in two arrangements next to each other (the last and the first count as next to each other). There are fewer pictures than
// there are places for them across all the arrangements, so a picture comes back only after the others have had their turn.
export const POOL = Array.from({ length: 14 }, (_, i) => `photo-${i + 1}.jpg`);

const shows = (id: string, state: string): boolean => (LAYOUTS[state]![id] ?? 0) > 0;
/** The cells that hold a picture (the ones that are not colour cards). */
export const PICTURE_CELLS = COLUMNS.flat().filter(id => !/^[yig]/.test(id));

/** Which picture each cell shows in each arrangement it is visible in. */
export const PICTURE_OF: Record<string, Record<string, string>> = (() => {
  const of: Record<string, Record<string, string>> = Object.fromEntries(STATE_ORDER.map(s => [s, {}]));
  let queue = [...POOL];   // the pictures in the order they have waited, the one that has waited longest first
  STATE_ORDER.forEach((state, k) => {
    const neighbours = [STATE_ORDER[(k + STATE_ORDER.length - 1) % STATE_ORDER.length]!, STATE_ORDER[(k + 1) % STATE_ORDER.length]!];
    for (const cell of PICTURE_CELLS.filter(id => shows(id, state))) {
      const used = new Set(Object.values(of[state]!));
      const next = new Set(neighbours.flatMap(n => Object.values(of[n]!)));
      const pick = queue.find(p => !used.has(p) && !next.has(p))!;
      of[state]![cell] = pick;
      queue = [...queue.filter(p => p !== pick), pick];   // it goes to the back of the line
    }
  });
  return of;
})();

/** Each cell's pictures, in the order it first shows them: the cell holds one image element for each, and an arrangement shows one of them. */
export const IMAGES_OF_CELL: Record<string, string[]> = Object.fromEntries(PICTURE_CELLS.map(cell => [
  cell,
  [...new Set(STATE_ORDER.map(s => PICTURE_OF[s]![cell]).filter((p): p is string => p !== undefined))],
]));

/** The name of an image element (its data-motion), e.g. pic-p0a-2: the cell and the place of the picture in the cell's list. */
export const layerName = (cell: string, picture: string): string => `pic-${cell}-${IMAGES_OF_CELL[cell]!.indexOf(picture) + 1}`;

/** The opacity each image element has in each state: 1 where it is the picture its cell shows there. 'cards' (the opening of v1) is the first arrangement's. */
export function pictureStates(states: string[]): Record<string, Record<string, { opacity: number }>> {
  const layers: Record<string, Record<string, { opacity: number }>> = {};
  for (const cell of PICTURE_CELLS) {
    for (const picture of IMAGES_OF_CELL[cell]!) {
      layers[layerName(cell, picture)] = Object.fromEntries(states.map(s => [s, { opacity: PICTURE_OF[s === 'cards' ? 'default' : s]![cell] === picture ? 1 : 0 }]));
    }
  }
  return layers;
}
