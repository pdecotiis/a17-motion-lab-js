import type { MotionVersion } from './types.js';

// How the Page view plays a version. The page preview is a fixed-height window you scroll, so a version
// whose trigger is `in-view` waits until its section enters the window, as it would on the real site.
// Everything else plays on load: a version with no trigger specified (the lab never guesses one), and the
// triggers a scroll cannot fire (load, hover, click, route-change).

export interface ScrollTrigger {
  /** Fraction of the section that must be visible (0–1) before it plays. 0 when the version names none: as soon as any of it shows. */
  threshold: number;
  /** true: the first time it enters only. false: every time it enters again. true when the version names none. */
  once: boolean;
  /** true: each animated element (each layer's elements) waits for and plays on its own entering the view, not the section as a whole. */
  each: boolean;
}

/** The scroll trigger of a version, or null when it plays on load. */
export function scrollTriggerOf(version: MotionVersion): ScrollTrigger | null {
  const trigger = version.trigger;
  if (!trigger || trigger.on !== 'in-view') return null;
  return { threshold: trigger.threshold ?? 0, once: trigger.once ?? true, each: trigger.each ?? false };
}

/**
 * The stagger index of a section. The sections already in view when the page opens start together, staggered
 * by their place in the page. A section that scrolls in later plays on its own, with no stagger: it is not
 * part of the page's opening.
 */
export function staggerIndex(pageIndex: number, opening: boolean): number {
  return opening ? pageIndex : 0;
}
