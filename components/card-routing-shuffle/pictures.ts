import { COLUMNS, LAYOUTS, STATE_ORDER, type Layout } from './layouts.js';
import { PAIR_LAYOUTS, PAIR_ORDER } from './layouts-pairs.js';

// The pictures. Every time the bento changes, its pictures change too: a cell does not keep its picture from one arrangement to the next, and a picture is never
// shown twice in one arrangement or in two arrangements next to each other (the last and the first count as next to each other). There are fewer pictures than
// there are places for them across all the arrangements, so a picture comes back only after the others have had their turn.
/** The pictures each cell holds in the markup, in the order of its image elements (pic-<cell>-<n>). */
export const CELL_PHOTOS: Record<string, number[]> = {
  p0a: [1, 4, 9, 14, 11, 7, 10, 13], p0b: [10, 1, 6, 12], p1a: [2, 5, 7, 8, 14], p1b: [6, 11, 3, 8, 13, 5], p2a: [3, 7, 12, 4, 9, 14, 6, 1], v2: [8, 13, 5, 10, 4],
};

export const POOL = Array.from({ length: 14 }, (_, i) => `photo-${i + 1}.jpg`);

/** The cells that hold a picture (the ones that are not colour cards). */
export const PICTURE_CELLS = COLUMNS.flat().filter(id => !/^[yigo]/.test(id));

/** Which picture each cell shows in each arrangement it is visible in, for a list of arrangements that follow one another round and round. */
function assign(layouts: Record<string, Layout>, order: string[], only?: Record<string, number[]>): Record<string, Record<string, string>> {
  const of: Record<string, Record<string, string>> = Object.fromEntries(order.map(s => [s, {}]));
  let queue = [...POOL];   // the pictures in the order they have waited, the one that has waited longest first
  order.forEach((state, k) => {
    const neighbours = [order[(k + order.length - 1) % order.length]!, order[(k + 1) % order.length]!];
    for (const cell of PICTURE_CELLS.filter(id => (layouts[state]![id] ?? 0) > 0)) {
      const used = new Set(Object.values(of[state]!));
      const next = new Set(neighbours.flatMap(n => Object.values(of[n]!)));
      const own = only?.[cell]?.map(n => `photo-${n}.jpg`);
      const pick = queue.find(p => (!own || own.includes(p)) && !used.has(p) && !next.has(p))!;
      of[state]![cell] = pick;
      queue = [...queue.filter(p => p !== pick), pick];   // it goes to the back of the line
    }
  });
  return of;
}

/** The pictures of v1, v2 and v3's arrangements, and of v4's. */
export const PICTURE_OF = assign(LAYOUTS, STATE_ORDER);
export const PAIR_PICTURE_OF = assign(PAIR_LAYOUTS, PAIR_ORDER, CELL_PHOTOS);   // a cell can only show the pictures its markup holds

/** Each cell's pictures, in the order it first shows them (the first arrangement's first): the cell holds one image element for each, and an arrangement shows one of them. */
export const IMAGES_OF_CELL: Record<string, string[]> = Object.fromEntries(PICTURE_CELLS.map(cell => [cell, (CELL_PHOTOS[cell] ?? []).map(n => `photo-${n}.jpg`)]));

/** The name of an image element (its data-motion), e.g. pic-p0a-2: the cell and the place of the picture in the cell's list. */
export const layerName = (cell: string, picture: string): string => `pic-${cell}-${IMAGES_OF_CELL[cell]!.indexOf(picture) + 1}`;

/** The opacity each image element has in each state: 1 where it is the picture its cell shows there. `first` is the state a state that is only an opening (v1's 'cards') looks like. */
export function pictureStates(states: string[], of: Record<string, Record<string, string>> = PICTURE_OF, first = 'default'): Record<string, Record<string, { opacity: number }>> {
  const layers: Record<string, Record<string, { opacity: number }>> = {};
  for (const cell of PICTURE_CELLS) {
    for (const picture of IMAGES_OF_CELL[cell]!) {
      layers[layerName(cell, picture)] = Object.fromEntries(states.map(s => [s, { opacity: (of[of[s] ? s : first] ?? {})[cell] === picture ? 1 : 0 }]));
    }
  }
  return layers;
}
