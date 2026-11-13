import type { MotionVersion } from '../../../lab/lib/types.js';

// v4: the prompts section (Read Next) with the approved motion of the original Motion Lab's "Read more block (Tech)", "Header + rows rise": the dark card rises in (24px, from 95%, fading in, 300ms on productive-standard), then 120ms
// later its eyebrow and its heading come in together (the eyebrow's letters scramble, GSAP ScrambleText over 0.56s with no easing, as in the original; its dot blink is not carried), then the five prompt rows rise 120ms apart (each 24px, fading in).
// It plays as a block when it is scrolled to: when 15% of the card (not the space above it) is on screen, the original's threshold-in-view of 15% of a component's height; the section has 96px of space above the card, so that is
// (96 + 15% of 328) / 424 of the section.
const STD = { model: 'tween' as const, duration: 'duration.300', easing: 'easing.productive-standard' };
// the original's entrance moves: a block rises 24px and scales up from 95% ('in'), a heading or an eyebrow rises 24px from 98% ('txt'), a row rises 24px ('row'), a link or an arrow rises a little ('follow'); all fade in
const IN = [{ opacity: 0, transform: 'translateY({distance.24}) scale({scale.95})', offset: 0 }, { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }];
const TXT = [{ opacity: 0, transform: 'translateY({distance.24}) scale({scale.98})', offset: 0 }, { opacity: 1, transform: 'translateY(0px) scale(1)', offset: 1 }];
const ROW = [{ opacity: 0, transform: 'translateY({distance.24})', offset: 0 }, { opacity: 1, transform: 'translateY(0px)', offset: 1 }];
const FOLLOW = [{ opacity: 0, transform: 'translateY({distance.8})', offset: 0 }, { opacity: 1, transform: 'translateY(0px)', offset: 1 }];
const at = (delay?: string) => ({ model: { ...STD, ...(delay ? { delay } : {}) } });

export const v4: MotionVersion = {
  id: 'v4',
  label: 'Approved read-more block: card, then eyebrow and heading, then the rows 120ms apart',
  model: { model: 'tween', duration: 'duration.100', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }],
  layers: {
    card: { ...at(), keyframes: IN },
    eyebrow: { ...at('delay.120'), keyframes: TXT },
    // the eyebrow's scramble: a motion on the label that changes nothing you can see (its opacity stays at 1); scramble.ts takes its progress (GSAP ScrambleText, 0.56s, no easing) so the letters resolve over the same 560ms
    label: { model: { model: 'tween', duration: 'duration.440', easing: 'easing.linear', delay: 'delay.120' }, keyframes: [{ opacity: 1, offset: 0 }, { opacity: 1, offset: 1 }] },
    title: { ...at('delay.120'), keyframes: TXT },
    'prompt-1': { ...at('duration.240'), keyframes: ROW },
    'prompt-2': { ...at('duration.360'), keyframes: ROW },
    'prompt-3': { ...at('duration.480'), keyframes: ROW },
    'prompt-4': { ...at('duration.600'), keyframes: ROW },
    'prompt-5': { ...at('duration.720'), keyframes: ROW },
  },
  trigger: { on: 'in-view', threshold: 0.3425, once: true },
  forkedFrom: 'v3',
};

export default v4;
