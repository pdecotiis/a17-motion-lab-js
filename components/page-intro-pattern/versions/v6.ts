import type { MotionVersion } from '../../../lab/lib/types.js';
// Retimed: the page elements come in together, starting 120ms after the title (with the page going to white where there is one), as in page version v11.
// Retimed: the idle part of the wait after the title is halved (the page elements come in 370ms after the title instead of 740); comments below that give the earlier times are the earlier sequence.

// v6: the white opening's pattern. The page is white from the first frame and stays white: the dots fade in over 300ms on the light page. They start stronger than they are at rest, about 35% (they are about 12% at rest: the darkest
// dot is 216 on a page of 245), so the pattern is seen during the intro, and they settle to their normal strength over 560ms from 1640ms, as the header, the nav and the bento come in. The strength is the dots' own opacity,
// drawn into the pattern (the invisible 'strength' element's opacity goes from 1 to 0 and the runtime draws each dot as many times as that asks for), not a filter, so nothing flashes. The page-coloured overlay that hides the pattern
// behind the nav and below the title is not there in the intro (the pattern fills the window) and fades in with the header, the nav and the bento, from 1640ms over 560ms.
const FADE = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-entrance' };

export const v6: MotionVersion = {
  id: 'v6',
  label: 'White opening: the pattern starts strong (35%) and settles as the page comes in',
  model: FADE,
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    field: { model: FADE, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }] },
    // the pattern clicks itself once as the title starts (300ms): a ring comes out of the middle of the page and spreads over the dots
    click: { model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance', delay: 'duration.300' }, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }] },
    strength: {
      model: { model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.1020' },
      keyframes: [{ opacity: 0.565, offset: 0 }, { opacity: 0, offset: 1 }],   // 0.565 of the way from the 12% they rest at to the 35% the strongest gives: 25% to start with
    },
    fade: {
      model: { model: 'tween', duration: 'duration.560', easing: 'easing.expressive-entrance', delay: 'duration.1020' },
      keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
    },
  },
  // the component starts and stays in its 'white' state (the runtime reads it as the light page; an interaction needs a second state to validate)
  interaction: { initial: 'white', states: { white: {}, dark: {} }, transitions: { white: FADE, dark: FADE } },
  forkedFrom: 'v5',
};

export default v6;
