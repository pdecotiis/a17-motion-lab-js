import gsap from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

// The eyebrow scramble of the original Motion Lab: the label's letters are random characters that resolve to the real ones over 0.56s, with GSAP's ScrambleText plugin and the original's settings:
//   scramble: { scrambleText: { text: "{original}" }, duration: 0.56, ease: "none" }
// The lab plays a motion with the Web Animations API (or Motion), and the markup cannot run a script, so this watches the page the way the pattern component does. A label marked data-scramble has a layer in its version
// (data-motion="label": its delay, a duration of 560ms, the linear easing and an opacity that stays at 1), so the lab plays it like any other motion, and this takes that animation's progress and hands it to the GSAP tween
// (paused, scrubbed with .progress()): the scramble starts, runs, replays, pauses and slows down exactly with the motion, whichever runtime plays it. When the motion is gone the text is the real text.
gsap.registerPlugin(ScrambleTextPlugin);

const SELECTOR = '[data-scramble]';
const originals = new WeakMap<HTMLElement, string>();
const tweens = new WeakMap<HTMLElement, gsap.core.Tween>();
let frame = 0;

function tweenOf(el: HTMLElement): gsap.core.Tween {
  let t = tweens.get(el);
  if (!t) {
    originals.set(el, el.textContent ?? '');
    t = gsap.to(el, { scrambleText: { text: '{original}', chars: 'lowerCase' }, duration: 0.56, ease: 'none', paused: true });
    tweens.set(el, t);
  }
  return t;
}

// the spaces of the real label stay spaces: only the letters scramble
function keepSpaces(el: HTMLElement): void {
  const real = originals.get(el), now = el.textContent ?? '';
  if (!real || real.length !== now.length) return;
  let out = '';
  for (let i = 0; i < real.length; i++) out += real[i] === ' ' ? ' ' : now[i];
  if (out !== now) el.textContent = out;
}

function step(): void {
  frame = 0;
  const labels = document.querySelectorAll<HTMLElement>(SELECTOR);
  if (!labels.length) return;                       // nothing to watch: the observer starts it again
  labels.forEach(el => {
    const anim = el.getAnimations().find(a => a.effect);
    if (!anim) { const t = tweens.get(el); if (t && t.progress() !== 1) t.progress(1); return; }
    // before its delay the label already shows the field of scrambled letters (the original: it arrives scrambled, holds, then resolves left to right); once the motion is over the real text
    const progress = anim.effect!.getComputedTiming().progress;
    tweenOf(el).progress(progress == null ? (anim.playState === 'finished' ? 1 : 0.001) : Math.max(0.001, Math.min(1, progress)));
    keepSpaces(el);
  });
  frame = requestAnimationFrame(step);
}

export function watchScramble(): void {
  if (typeof document === 'undefined') return;       // the unit tests load every component in Node
  const start = (): void => { if (!frame && document.querySelector(SELECTOR)) frame = requestAnimationFrame(step); };
  start();
  new MutationObserver(start).observe(document.documentElement, { childList: true, subtree: true });
}
