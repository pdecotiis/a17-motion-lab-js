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

// where a panel is in a state: open, waiting below the stage to come in, or closed at the top after it went
const OPEN = { height: 'calc(100cqh + 0px)', marginTop: 'calc(0cqh + 0px)' };
const BELOW = { height: 'calc(0cqh + 0px)', marginTop: 'calc(100cqh + 8px)' };
const GONE = { height: 'calc(0cqh + 0px)', marginTop: 'calc(0cqh + 0px)' };
// panel i in slide s: open when it is the slide, below when it is the next one, gone when it is the one before
const placeOf = (panel: number, slide: number) => (panel === slide ? OPEN : (panel - slide + 3) % 3 === 1 ? BELOW : GONE);

type Layers = NonNullable<NonNullable<MotionVersion['interaction']>['layers']>;
const layers: Layers = {};
const ZOOM = '{scale.106}';
const CARD_OF = ['m-card', 't-card', 'e-card'];
for (let p = 0; p < 3; p++) {
  const stateMap = <T>(f: (slide: number) => T): Record<string, T> => Object.fromEntries(ALL.map(s => [s, f(indexOf(s))]));
  layers[`panel-${p + 1}`] = { states: stateMap(i => placeOf(p, i)), transitions: stateMap(() => MOVE) };
  // the card's title and arrow: there while its arrangement is open, out in 280ms (twice as fast as the morph) as it closes, back in 280ms, a beat (delay.120) after the arrangement starts to open
  layers[`route-${CARD_OF[p]}`] = {
    states: stateMap(i => ({ opacity: i === p ? 1 : 0 })),
    transitions: stateMap(i => (i === p
      ? { model: 'tween' as const, duration: 'duration.280', easing: 'easing.productive-entrance', delay: 'delay.120' }
      : { model: 'tween' as const, duration: 'duration.280', easing: 'easing.productive-exit' })),
  };
  // the contents of the panel fade as the panel is nearly closed (a card a few pixels high would show a hard line, its rounded corners cut off): out over the last part of the morph (from 300ms, 220ms long), in over the first
  layers[`fade-${p + 1}`] = {
    states: stateMap(i => ({ opacity: i === p ? 1 : 0 })),
    transitions: stateMap(i => (i === p
      ? { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-entrance' }
      : { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-exit', delay: 'duration.300' })),
  };
  // the shapes (the card fills and the squares) lose their rounded corners as the panel closes (a card a few pixels high with round corners is a hard line) and get them back as it opens
  layers[`shape-${p + 1}`] = {
    states: stateMap(i => ({ borderRadius: i === p ? '24px' : '0px' })),
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
  label: 'Three arrangements from the frames, each coming in from the bottom',
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
