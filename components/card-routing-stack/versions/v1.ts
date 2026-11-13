import type { MotionVersion } from '../../../lab/lib/types.js';

// v1: the bento of the mobile homepage (a 400px page). Three arrangements (machine learning, trading, technology), each a colour card and a big picture in one column, the card at the top in machine learning and technology and at
// the bottom in trading. A change is the middle column of the desktop bento: the arrangement that goes closes and the one that comes opens, in height only, and because of the order of the cells in the column (a card for the top, picture,
// picture, a card for the bottom) the new picture opens between the card and the picture that is going, pushing them out, while the new card opens at its edge. A cell's box is its visible part plus the 8px gutter under it, so the gap is
// 8px all through a move; the shapes lose their corners and fade as they close, the pictures settle from 106% as they open, a card's title fades a beat after it opens. It plays on the same 560ms expressive-standard move as the desktop
// bento, and comes in with the page: the first arrangement's two cells with the card preset, then the bullets. The loop runs by itself every five seconds, holding while a card is pressed; a bullet goes to its slide.
const MOVE = { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-standard' };
const SLIDES = ['slide-1', 'slide-2', 'slide-3'] as [string, string, string];
const ALL = ['slide-0', ...SLIDES];
const slideOf = (state: string) => (state === 'slide-0' ? 0 : Number(state.slice(-1)) - 1);
const CARD = 'calc(22.8cqh + 8px)', PIC = 'calc(77.2cqh + 0px)', ZERO = 'calc(0cqh + 0px)';
// each cell: the slide it is open in, and how tall it is then
const CELLS: Record<string, [number, string]> = { 'm-card': [0, CARD], 'm-pic': [0, PIC], 't-pic': [1, PIC], 't-card': [1, CARD], 'e-card': [2, CARD], 'e-pic': [2, PIC] };
const CARD_OF = ['m-card', 't-card', 'e-card'];
const ZOOM = '{scale.106}';

type Layers = NonNullable<NonNullable<MotionVersion['interaction']>['layers']>;
const layers: Layers = {};
const stateMap = <T>(f: (slide: number) => T): Record<string, T> => Object.fromEntries(ALL.map(s => [s, f(slideOf(s))]));
for (const [id, [slide, height]] of Object.entries(CELLS)) {
  layers[id] = { states: stateMap(i => ({ height: i === slide ? height : ZERO })), transitions: stateMap(() => MOVE) };
}
const prefix = ['m', 't', 'e'];
for (let p = 0; p < 3; p++) {
  layers[`route-${prefix[p]}-card`] = {
    states: stateMap(i => ({ opacity: i === p ? 1 : 0 })),
    transitions: stateMap(i => (i === p
      ? { model: 'tween' as const, duration: 'duration.280', easing: 'easing.productive-entrance', delay: 'delay.120' }
      : { model: 'tween' as const, duration: 'duration.280', easing: 'easing.productive-exit' })),
  };
  layers[`shape-${p + 1}`] = {
    states: stateMap(i => ({ borderRadius: i === p ? '16px' : '0px', opacity: i === p ? 1 : 0 })),
    transitions: stateMap(i => (i === p
      ? { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-entrance' }
      : { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-exit', delay: 'duration.300' })),
  };
  layers[`pic-${p + 1}`] = {
    states: stateMap(i => ({ scale: i === p ? 1 : ZOOM })),
    transitions: stateMap(i => (i === p
      ? { model: 'tween' as const, duration: 'duration.560', easing: 'easing.expressive-entrance' }
      : { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-exit', delay: 'duration.560' })),
  };
}

export const v1: MotionVersion = {
  id: 'v1',
  label: 'Phone bento: a card and a big picture, the new picture opening between the card and the one that goes (height only)',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    'm-card': { preset: 'card', delay: 'duration.1160' },
    'm-pic': { preset: 'card', delay: 'duration.1230' },
    dots: { model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance', delay: 'duration.1300' }, keyframes: [{ opacity: 0, transform: 'translateY({distance.12}) scale({scale.95})', offset: 0 }, { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }] },
  },
  interaction: {
    initial: 'slide-0',
    hold: 'duration.100',
    states: Object.fromEntries(ALL.map(s => [s, {}])),
    transitions: Object.fromEntries(ALL.map(s => [s, MOVE])),
    layers,
    triggers: [
      ...SLIDES.map((state, i) => ({ on: 'click' as const, set: state, target: `dot-${i + 1}` })),
      { on: 'interval', every: '5000ms', toggle: SLIDES, pauseOnHover: CARD_OF },
    ],
  },
  elements: { ...Object.fromEntries(CARD_OF.map(id => [id, 'card'])), dots: 'button' },
  lineage: 'new: the bento for a phone, from the desktop morph bento (the middle column\'s move, in one column)',
};

export default v1;
