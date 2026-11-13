import type { MotionVersion } from '../../../lab/lib/types.js';
import { BANDS, CELLS, FEATURE_CARDS, SLIDE_GROUPS, bandStyleOf, cellStyleOf, groupOfCard, lookOf } from '../geometry.js';

// v4: the slideshow of the opening of page version v13, drawn from three Figma frames (home, 1440 x 2219): the bento has three arrangements, one of each story, and no more. Machine learning first, then trading, then technology.
// Each is the second look of its story in v1 (the card with a row of two squares, and a big picture), so the first look, the three small intro cards and the wide picture are cut: the stage starts in the first arrangement.
//   slide-1  machine learning: the card on top and the picture and the pattern below it, at the left; a big picture at the right
//   slide-2  trading:          the picture and the pattern on top of the card, at the left; a big picture at the right
//   slide-3  technology:       a big picture at the left; the card on top and the pattern and the picture below it, at the right
// It comes in as part of the page's one stagger (70ms apart): the header, the sidebar, then the bento's three parts, then its controls. Each rises 24px, scales up from 95% and fades in (the card preset). The loop then runs by itself
// every five seconds (pausing on hover and with the play / pause button), and every change is a morph in the way of the tabs of grid-container-mosaic-routing v7, slightly faster (560ms where it takes 800): the arrangement that goes
// gives its room to the one that comes, its parts shrinking as the others grow and push them; nothing fades out and nothing moves except by being pushed. The pictures of the arrangement that opens settle from 106% to 100% as it opens
// (v7's), and are reset only after the arrangement has closed, so no scaling is seen on the way out.
const MOVE = { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-standard' };
const FADE = { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-standard' };

// the three arrangements and the state of the geometry each one is (geometry.ts)
const GEO: Record<string, string> = { 'slide-1': 'machine-learning-2', 'slide-2': 'trading-2', 'slide-3': 'technology-2' };
const SLIDES = Object.keys(GEO) as [string, string, string];
const each = <T>(f: (geo: string) => T): Record<string, T> => Object.fromEntries(SLIDES.map(s => [s, f(GEO[s]!)]));

const layers: NonNullable<NonNullable<MotionVersion['interaction']>['layers']> = {};
for (const band of BANDS) layers[band] = { states: each(g => bandStyleOf(band, g)), transitions: each(() => MOVE) };
for (const cell of CELLS) {
  layers[cell.id] = { states: each(g => cellStyleOf(cell, g)), transitions: each(() => MOVE) };
}
// a colour card's title and arrow (the small card's contents) are there while its story is up and fade out as the card closes, twice as fast as the card's own morph (280ms where it takes 560ms), straight away; they fade back in
// as it opens, a beat (delay.120) after it starts to grow, at the same speed. The card's other contents (the big card's, look A of v1) are not used here.
for (const card of FEATURE_CARDS) {
  const group = groupOfCard(card);
  const up = (g: string) => lookOf(group, g) !== undefined;
  layers[`feature-${card}`] = { states: each(() => ({ opacity: 0 })), transitions: each(() => FADE) };
  layers[`route-${card}`] = {
    states: each(g => ({ opacity: up(g) ? 1 : 0 })),
    transitions: Object.fromEntries(SLIDES.map(s => [s, up(GEO[s]!)
      ? { model: 'tween' as const, duration: 'duration.280', easing: 'easing.productive-entrance', delay: 'delay.120' }
      : { model: 'tween' as const, duration: 'duration.280', easing: 'easing.productive-exit' }])),
  };
}
for (const card of ['intro-ml', 'intro-trading', 'intro-technology']) layers[`route-${card}`] = { states: each(() => ({ opacity: 0 })), transitions: each(() => FADE) };

// the pictures of the story that opens settle from 106% to 100% (v7's), and go back to 106% only after the arrangement has closed (560ms later), when they are too small to show it
const ZOOM = '{scale.106}';
for (const group of SLIDE_GROUPS) {
  const up = (g: string) => lookOf(group, g) !== undefined;
  layers[`pic-${group}`] = {
    states: each(g => ({ scale: up(g) ? 1 : ZOOM })),
    transitions: Object.fromEntries(SLIDES.map(s => [s, up(GEO[s]!)
      ? { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-entrance' }
      : { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-exit', delay: 'duration.560' }])),
  };
}

const CARDS = FEATURE_CARDS;

export const v4: MotionVersion = {
  id: 'v4',
  label: 'Opening v13: three arrangements from the frames, morphing like the tabs of mosaic v7',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    // the first arrangement's three parts, then the controls
    'in-m-card': { preset: 'card', delay: 'duration.1960' },
    'in-m-row': { preset: 'card', delay: 'duration.2030' },
    'in-m-large': { preset: 'card', delay: 'duration.2100' },
    pager: { preset: 'card', delay: 'duration.2170' },
    float: { preset: 'card', delay: 'duration.2170' },
  },
  interaction: {
    initial: SLIDES[0],
    states: each(() => ({})),
    transitions: each(() => MOVE),
    layers,
    triggers: [
      { on: 'click', toggle: SLIDES, target: 'next' },
      { on: 'click', toggle: [...SLIDES].reverse() as [string, string, string], target: 'prev' },
      ...SLIDES.map((state, i) => ({ on: 'click' as const, set: state, target: `dot-${i + 1}` })),
      // and by itself: five seconds after the last change, unless paused (the fill on the bullet takes the same five seconds: keep them equal)
      { on: 'interval', every: '5000ms', toggle: SLIDES, pause: 'playpause', pauseOnHover: CARDS },
    ],
  },
  elements: { ...Object.fromEntries(CARDS.map(id => [id, 'card'])), prev: 'button', next: 'button', playpause: 'button', dots: 'button' },
  forkedFrom: 'v3',
};

export default v4;
