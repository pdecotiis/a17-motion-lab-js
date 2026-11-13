import type { MotionVersion } from '../../../lab/lib/types.js';
// Retimed: the page elements come in together, starting 120ms after the title (with the page going to white where there is one), as in page version v11.
// Retimed: the idle part of the wait after the title is halved (the black to white starts 120ms after the title instead of 240, and the page elements 60ms after it instead of 120); comments below that give the earlier times are the earlier sequence.

// v1: the bento of the homepage opening (page version v13), three arrangements drawn from the Figma frames (home, 1440 x 2219), and every change comes in from the bottom, including the one that starts over.
//   slide-1  machine learning: an orange card on top and the hands photo and a yellow-green pattern below it, at the left; a big picture at the right
//   slide-2  trading:          a big picture at the left; a green pattern and a photo on top of the periwinkle card, at the right
//   slide-3  technology:       a yellow-green card on top and an orange pattern and the hands photo below it, at the left; a big picture at the right
// A change is a morph in the way of the tabs of grid-container-mosaic-routing v7, slightly faster (560ms where it takes 800): the arrangement that comes grows up from the bottom edge of the stage while the one that goes
// shrinks away at the top, and everything in each squeezes or opens with it (the cards shrink, the squares and pictures are windows that close or open). Nothing slides or fades to make room: the parts are pushed. Three panels
// do it, one per arrangement, each a window whose height and top margin are states (in every state one panel is open, the one that is next waits below the stage (height 0, 108px under the top edge) and the one that was
// there has closed at the top), so going on, even from technology back to machine learning, always opens the next one from the bottom, and going back is the same move in reverse.
// A panel's contents fade out over the last part of its closing (from 300ms of the 560ms, 220ms long) and in over the first part of its opening, so a card a few pixels high never shows a hard line; a card's title and arrow fade out in 280ms, twice as fast as the card's own 560ms morph, and back in a beat after it starts to open.
// The shapes (the card fills and the squares) lose their rounded corners as a panel closes and get them back as it opens, so a card a few pixels high is not a rounded sliver (together with the fade). The pictures of the arrangement that opens settle from
// 106% to 100% (v7's), and are put back only after it has closed. The bento comes in as part of the page's one stagger (70ms apart): the header and the sidebar first, then the first arrangement's three parts, then the controls; each rises 24px, scales up
// from 95% and fades in (the card preset). The loop then runs by itself every five seconds, pausing on hover and with the play / pause button.
const MOVE = { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-standard' };
const SLIDES = ['slide-1', 'slide-2', 'slide-3'] as [string, string, string];
// the stage starts in 'slide-0', which looks exactly like slide-1 (machine learning open): the first move, once the controls are in, goes into slide-1, which starts the bullet's fill (it is keyed on the state), so the first
// bullet fills over its five seconds like the others (from the page load it would have run out before the controls came in) and the loop's five seconds start with it
const ALL = ['slide-0', ...SLIDES];
const indexOf = (state: string) => (state === 'slide-0' ? 0 : Number(state.slice(-1)) - 1);

// Every cell of every arrangement sits in its column (left: machine learning's card, technology's card, trading's big picture, technology's row, machine learning's row; right: trading's row, machine learning's big
// picture, technology's big picture, trading's card). A change is the shuffle bento's move in each column: the cells of the arrangement that goes close and the ones of the arrangement that comes open, and because of the order in
// the column the big picture opens (or closes) from the middle between the card and the row, pushing them out, and the cards and rows open at the edges. Heights are shares of the stage (cqh) so it keeps its proportions.
// a cell's box is its visible part plus the 8px gutter under it (the stylesheet leaves the gutter empty), so the gap between two cells is 8px all through a move, as in the shuffle bento: a cell that opens grows its gutter first and
// shows after it, and one that closes keeps its gutter until it has gone
const HALF = 'calc(50cqh + 4px)', FULL = 'calc(100cqh + 8px)', ZERO = 'calc(0cqh + 0px)';
// how tall each cell is in each slide (0 machine learning, 1 trading, 2 technology): [slide, height]
const CELLS: Record<string, [number, string]> = {
  'm-card': [0, HALF], 'm-row': [0, HALF], 'm-large': [0, FULL],
  't-row': [1, HALF], 't-card': [1, HALF], 't-large': [1, FULL],
  'e-card': [2, HALF], 'e-row': [2, HALF], 'e-large': [2, FULL],
};
const PANEL_OF = ['m', 't', 'e'];
const CARD_OF = ['m-card', 't-card', 'e-card'];

type Layers = NonNullable<NonNullable<MotionVersion['interaction']>['layers']>;
const layers: Layers = {};
const ZOOM = '{scale.106}';
const stateMap = <T>(f: (slide: number) => T): Record<string, T> => Object.fromEntries(ALL.map(s => [s, f(indexOf(s))]));
for (const [id, [slide, height]] of Object.entries(CELLS)) {
  layers[id] = {
    states: stateMap(i => ({ height: i === slide ? height : ZERO })),
    transitions: stateMap(() => MOVE),
  };
}
for (let p = 0; p < 3; p++) {
  // the card's title and arrow: there while its arrangement is open, out in 280ms (twice as fast as the move) as it closes, back in 280ms, a beat (delay.120) after the arrangement starts to open
  layers[`route-${PANEL_OF[p]}-card`] = {
    states: stateMap(i => ({ opacity: i === p ? 1 : 0 })),
    transitions: stateMap(i => (i === p
      ? { model: 'tween' as const, duration: 'duration.280', easing: 'easing.productive-entrance', delay: 'delay.120' }
      : { model: 'tween' as const, duration: 'duration.280', easing: 'easing.productive-exit' })),
  };
  // the shapes (the card fills and the squares, the big pictures) lose their rounded corners and fade as their cell closes (a card a few pixels high with round corners is a hard line): out over the last part of the move
  // (from 300ms, 220ms long), in over the first part of its opening
  layers[`shape-${p + 1}`] = {
    states: stateMap(i => ({ borderRadius: i === p ? '24px' : '0px', opacity: i === p ? 1 : 0 })),
    transitions: stateMap(i => (i === p
      ? { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-entrance' }
      : { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-exit', delay: 'duration.300' })),
  };
  // the pictures of the arrangement that opens settle from 106% to 100%; they are put back only after it has closed, when they are too small to show it
  layers[`pic-${p + 1}`] = {
    states: stateMap(i => ({ scale: i === p ? 1 : ZOOM })),
    transitions: stateMap(i => (i === p
      ? { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-entrance' }
      : { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-exit', delay: 'duration.560' })),
  };
}

const CONTROL_IN = [{ opacity: 0, transform: 'translateY({distance.12}) scale({scale.95})', offset: 0 }, { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }];

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Three arrangements from the frames, each column changing in place: the big picture opens from between the cards',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    // the first arrangement's three parts, then the controls
    'm-card': { preset: 'card', delay: 'duration.1160' },
    'm-row': { preset: 'card', delay: 'duration.1230' },
    'm-large': { preset: 'card', delay: 'duration.1300' },
    // the controls one after another, 15ms apart: each fades in, scales up from 95% and rises 12px into place (400ms on expressive-entrance)
    prev: { model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.1370' }, keyframes: CONTROL_IN },
    next: { model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.1385' }, keyframes: CONTROL_IN },
    playpause: { model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.1400' }, keyframes: CONTROL_IN },
    dots: { model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.1415' }, keyframes: CONTROL_IN },
  },
  interaction: {
    initial: 'slide-0',
    hold: 'duration.100',   // after the controls are in, the first move goes into slide-1 (no change to look at: slide-0 is slide-1)
    states: Object.fromEntries(ALL.map(s => [s, {}])),
    transitions: Object.fromEntries(ALL.map(s => [s, MOVE])),
    layers,
    triggers: [
      { on: 'click', toggle: SLIDES, target: 'next' },
      { on: 'click', toggle: [...SLIDES].reverse() as [string, string, string], target: 'prev' },
      ...SLIDES.map((state, i) => ({ on: 'click' as const, set: state, target: `dot-${i + 1}` })),
      // and by itself: five seconds after the last change, unless paused (the fill on the bullet takes the same five seconds: keep them equal)
      { on: 'interval', every: '5000ms', toggle: SLIDES, pause: 'playpause', pauseOnHover: CARD_OF },
    ],
  },
  elements: { ...Object.fromEntries(CARD_OF.map(id => [id, 'card'])), prev: 'button', next: 'button', playpause: 'button', dots: 'button' },
  lineage: 'new: three arrangements from the Figma frames (machine learning, trading, technology) with the pagination of card-routing-shuffle v5, morphing like the tabs of grid-container-mosaic-routing v7',
};

export default v1;
