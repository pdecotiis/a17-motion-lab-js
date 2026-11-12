import type { MotionVersion } from '../../../lab/lib/types.js';
import { BANDS, CELLS, FEATURE_CARDS, INTRO_STATES, SLIDES, STATES, bandStyleOf, cellStyleOf, groupOfCard, lookOf } from '../geometry.js';

// v1: the slideshow, and it morphs. An intro (the three colour cards appear, a wide picture opens above them and pushes them down), then six slides, three pairs: in each pair one big colour
// card sits next to a big picture (look A), then the card is squeezed to half its height while a picture and a pattern open in the room it gave up (look B). Nothing slides: when a pair
// ends, the parts of the next one grow while the parts of the one before collapse, so each gives its room to the other, the way the shuffle's cells do (geometry.ts says how big every
// part is in every state). The pagination is v5's of card-routing-shuffle: arrows, play / pause, and a pill of six bullets that fill over the 5 seconds of each slide.
const FADE = { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-standard' };   // the contents of a card swap about twice as fast as the card resizes
const MOVE = { model: 'tween' as const, duration: 'duration.400', easing: 'easing.expressive-standard' };
const ids = STATES.map(s => s.id);
const each = <T>(f: (s: string) => T): Record<string, T> => Object.fromEntries(ids.map(s => [s, f(s)]));
const SLIDE_LIST = SLIDES as [string, string, ...string[]];

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const band of BANDS) layers[band] = { states: each(s => bandStyleOf(band, s)), transitions: each(() => MOVE) };
for (const cell of CELLS) layers[cell.id] = { states: each(s => cellStyleOf(cell, s)), transitions: each(() => MOVE) };
// a colour card shows the big card's contents (title, copy, pattern) in look A and the small card's (title, arrow) in look B; the intro's cards show theirs until the slides take over
for (const card of FEATURE_CARDS) {
  const group = groupOfCard(card);
  layers[`feature-${card}`] = { states: each(s => ({ opacity: lookOf(group, s) === 'A' ? 1 : 0 })), transitions: each(() => FADE) };
  layers[`route-${card}`] = { states: each(s => ({ opacity: lookOf(group, s) === 'B' ? 1 : 0 })), transitions: each(() => FADE) };
}
const INTRO_CARDS = ['intro-ml', 'intro-trading', 'intro-technology'];
for (const card of INTRO_CARDS) layers[`route-${card}`] = { states: each(s => ({ opacity: INTRO_STATES.includes(s) ? 1 : 0 })), transitions: each(() => FADE) };

// hovering a colour card holds the timer and the bullet's fill
const CARDS = [...INTRO_CARDS, ...FEATURE_CARDS];

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Slideshow: cards squeeze to make room, parts grow and collapse',
  // the stage fades in quickly and the three colour cards rise in with the card preset; the intro then plays by itself (the sequence), and the slides follow
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: { 'intro-ml': { preset: 'card' }, 'intro-trading': { preset: 'card', delay: 'delay.70' }, 'intro-technology': { preset: 'card', delay: 'delay.120' } },
  interaction: {
    initial: INTRO_STATES[0]!,
    states: each(() => ({})),
    transitions: each(() => MOVE),
    layers,
    triggers: [
      // the intro, by itself, after the cards have appeared: the picture opens above the cards, then the first slide takes the stage
      { on: 'sequence', steps: [['intro-image', '400ms'], [SLIDES[0]!, '1300ms']] },
      { on: 'click', toggle: SLIDE_LIST, target: 'next' },
      { on: 'click', toggle: [...SLIDE_LIST].reverse() as [string, string, ...string[]], target: 'prev' },
      ...SLIDES.map((state, i) => ({ on: 'click' as const, set: state, target: `dot-${i + 1}` })),
      // and by itself: five seconds after the last change, unless paused (the fill on the bullet takes the same five seconds: keep them equal)
      { on: 'interval', every: '5000ms', toggle: SLIDE_LIST, pause: 'playpause', pauseOnHover: CARDS },
    ],
  },
  elements: { ...Object.fromEntries(CARDS.map(id => [id, 'card'])), prev: 'button', next: 'button', playpause: 'button', dots: 'button' },
  lineage: 'new: the pagination of card-routing-shuffle v5, with the cards squeezing to make room the way the reference video does (Figma frames: trading, technology and machine learning, each in two looks)',
};

export default v1;
