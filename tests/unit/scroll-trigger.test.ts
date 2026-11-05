import { describe, it, expect } from 'vitest';
import { scrollTriggerOf, staggerIndex } from '../../lab/lib/scroll-trigger.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const version = (trigger?: MotionVersion['trigger']): MotionVersion => ({
  id: 'v1',
  label: 'v1',
  model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance' },
  keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
  lineage: 'imported from test',
  ...(trigger ? { trigger } : {}),
});

describe('scrollTriggerOf', () => {
  it('waits for the section to scroll in when the trigger is in-view', () => {
    expect(scrollTriggerOf(version({ on: 'in-view', threshold: 0.2, once: true }))).toEqual({ threshold: 0.2, once: true });
    expect(scrollTriggerOf(version({ on: 'in-view', threshold: 0.5, once: false }))).toEqual({ threshold: 0.5, once: false });
  });

  it('uses as soon as any of it shows, and only the first time, when the version names neither', () => {
    expect(scrollTriggerOf(version({ on: 'in-view' }))).toEqual({ threshold: 0, once: true });
  });

  it('plays on load when no trigger is specified (the lab never guesses one)', () => {
    expect(scrollTriggerOf(version())).toBeNull();
  });

  it('plays on load for the triggers a scroll cannot fire', () => {
    for (const on of ['load', 'hover', 'click', 'route-change'] as const) {
      expect(scrollTriggerOf(version({ on }))).toBeNull();
    }
  });
});

describe('staggerIndex', () => {
  it('staggers the sections already in view when the page opens, by their place in the page', () => {
    expect(staggerIndex(0, true)).toBe(0);
    expect(staggerIndex(2, true)).toBe(2);
  });

  it('plays a section that scrolls in later on its own, with no stagger', () => {
    expect(staggerIndex(2, false)).toBe(0);
  });
});
