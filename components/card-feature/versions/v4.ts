import type { MotionVersion } from '../../../lab/lib/types.js';

// v4: the feature card (Partner with us) with the approved motion of the original Motion Lab's storytelling card ("Storytelling card, arrow uses the button component", card/feature):
//   enter:  the card rises in from 24px below, scaled to 95%, fading in, 300ms on productive-standard; its eyebrow comes in at 220ms (its letters scramble: GSAP ScrambleText, 0.56s, no easing, as in the original)
//   hover:  the card does not scale; a circle comes up behind the arrow, the quiet tint the secondary buttons show (black at 4%, 8% when pressed, 100ms on productive-standard), wherever the pointer is on the card; neither the card nor its picture scale and the card's colour does not change.
//           press: the card dips to 98% over 100ms on productive-standard, the card preset's press, and comes back as it is let go.
// It plays when it is scrolled to: when 15% of the card (not the space above it) is on screen, the original's threshold-in-view of 15% of a component's height; the section has 160px of space above the card, so that is
// (160 + 15% of 357) / 517 of the section. Not carried: the eyebrow's dot blink.
const STD = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
// the original's entrance moves: a block rises 24px and scales up from 95% ('in'), a heading or an eyebrow rises 24px from 98% ('txt'), a row rises 24px ('row'), a link or an arrow rises a little ('follow'); all fade in
const PRESS_TIMING = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-standard' };
const IN = [{ opacity: 0, transform: 'translateY({distance.24}) scale({scale.95})', offset: 0 }, { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }];
const TXT = [{ opacity: 0, transform: 'translateY({distance.24}) scale({scale.98})', offset: 0 }, { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }];
const ROW = [{ opacity: 0, transform: 'translateY({distance.24})', offset: 0 }, { opacity: 1, transform: 'translateY(0px)', offset: 1 }];
const FOLLOW = [{ opacity: 0, transform: 'translateY({distance.8})', offset: 0 }, { opacity: 1, transform: 'translateY(0px)', offset: 1 }];
const at = (delay?: string) => ({ model: { ...STD, ...(delay ? { delay } : {}) } });

export const v4: MotionVersion = {
  id: 'v4',
  label: 'Approved storytelling card: rise in, eyebrow at 220ms, hover and press',
  model: STD,
  keyframes: IN,
  layers: {
    eyebrow: { ...at('duration.220'), keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }] },
    // the eyebrow's scramble: a motion on the label that changes nothing you can see (its opacity stays at 1); scramble.ts takes its progress (GSAP ScrambleText, 0.56s, no easing) so the letters resolve over the same 560ms
    label: { model: { model: 'tween', duration: 'duration.340', easing: 'easing.linear', delay: 'duration.220' }, keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }] },
  },
  interaction: {
    initial: 'default',
    states: { default: {}, hovered: {}, pressed: {} },
    transitions: {
      default: STD,
      hovered: STD,
      pressed: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-standard' },
    },
    layers: {
      card: { states: { default: {}, hovered: {}, pressed: { transform: 'scale({scale.98})' } } },
      // the circle behind the arrow: the arrow button is a 48px circle with no fill; on hover it takes the tint
      button: {
        states: { default: { backgroundColor: 'rgba(0, 0, 0, 0)' }, hovered: { backgroundColor: 'rgba(0, 0, 0, 0.04)' }, pressed: { backgroundColor: 'rgba(0, 0, 0, 0.08)' } },
        transitions: { default: PRESS_TIMING, hovered: PRESS_TIMING, pressed: PRESS_TIMING },
      },
    },
    triggers: [
      { on: 'hover', state: 'hovered', target: 'card' },
      { on: 'press', state: 'pressed', target: 'card' },
    ],
  },
  trigger: { on: 'in-view', threshold: 0.413, once: true },
  forkedFrom: 'v3',
};

export default v4;
