import { describe, it, expect } from 'vitest';
import { toMotionKeyframes, motionArgsOf, describeMotionArgs } from '../../lab/lib/motion-args.js';
import { runtimeFromParam, cssHandle } from '../../lab/lib/runtime.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const raw: Record<string, unknown> = {
  'duration.300': '300ms',
  'duration.220': '220ms',
  'easing.entrance': [0, 0, 0.38, 0.9],
  'delay.70': '70ms',
  'distance.16': '16px',
};

const tween: MotionVersion = {
  id: 'v1',
  label: 'Fade Up',
  model: { model: 'tween', duration: 'duration.220', easing: 'easing.entrance', delay: 'delay.70' },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.16})' },
    { opacity: 1, transform: 'translateY(0)' },
  ],
};

const spring: MotionVersion = {
  id: 'v2',
  label: 'Scale In',
  model: {
    model: 'spring', duration: 'duration.300', easing: 'easing.entrance', bounce: 0.3,
    properties: [
      { property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1 },
      { property: 'opacity', from: 0, to: 1 },
    ],
  },
};

describe('toMotionKeyframes', () => {
  it('turns WAAPI frames into one list of values per property', () => {
    expect(toMotionKeyframes([{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'scale(1)' }])).toEqual({
      opacity: [0, 1], transform: ['scale(0.9)', 'scale(1)'],
    });
  });

  it('repeats a neighbour where a frame leaves a property out', () => {
    expect(toMotionKeyframes([{ opacity: 0 }, { opacity: 1, transform: 'scale(1)' }, { opacity: 1 }]).transform)
      .toEqual(['scale(1)', 'scale(1)', 'scale(1)']);
  });
});

describe('motionArgsOf: under Motion every motion is a spring', () => {
  it('a tween plays as a spring with no bounce: its duration is when it arrives, and its easing is not used', () => {
    const a = motionArgsOf(tween, raw);
    expect(a.options).toEqual({ type: 'spring', visualDuration: 0.22, bounce: 0, delay: 0.07 });
    expect(a.keyframes).toEqual({ opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0)'] });
    expect(a.note).toBe('authored as easing, so no bounce');
    expect(JSON.stringify(a)).not.toContain('ease');
  });

  it('adds the stagger to the delay', () => {
    expect(motionArgsOf(tween, raw, { extraDelayMs: 140 }).options.delay).toBeCloseTo(0.21, 6);
  });

  it('a spring version keeps its own bounce, with its duration as the visual duration', () => {
    const a = motionArgsOf(spring, raw);
    expect(a.options).toEqual({ type: 'spring', visualDuration: 0.3, bounce: 0.3, delay: 0 });
    expect(a.keyframes).toEqual({ transform: ['scale(0.92)', 'scale(1)'], opacity: [0, 1] });
    expect(a.note).toBeUndefined();
  });

  it('plays start to end: a tween with frames between skips them, and says so', () => {
    const three: MotionVersion = { ...tween, keyframes: [{ opacity: 0 }, { opacity: 0.6 }, { opacity: 1 }] };
    const a = motionArgsOf(three, raw);
    expect(a.keyframes).toEqual({ opacity: [0, 1] });
    expect(a.note).toMatch(/skipping the frames between/);
  });

  it('reduced motion is the short opacity-only fade, as a spring with no bounce', () => {
    for (const v of [tween, spring]) {
      const a = motionArgsOf(v, raw, { reducedMotion: true });
      expect(Object.keys(a.keyframes)).toEqual(['opacity']);
      expect(a.options.type).toBe('spring');
      expect(a.options.bounce).toBe(0);
      expect(a.options.visualDuration).toBeLessThanOrEqual(0.15);
    }
    expect(motionArgsOf(spring, raw, { reducedMotion: true }).note).toMatch(/reduced motion/);
  });

  it('does not apply the playback rate: the caller sets Motion\'s speed', () => {
    expect(motionArgsOf(tween, raw).options.visualDuration).toBe(0.22);
  });
});

describe('describeMotionArgs', () => {
  it('says what plays, in a line, always a spring', () => {
    expect(describeMotionArgs(motionArgsOf(tween, raw))).toBe('Spring · bounce 0, 220ms (authored as easing, so no bounce)');
    expect(describeMotionArgs(motionArgsOf(spring, raw))).toBe('Spring · bounce 0.3, 300ms');
  });
});

describe('runtime', () => {
  it('runtimeFromParam is CSS unless asked for Motion', () => {
    expect(runtimeFromParam('motion')).toBe('motion');
    expect(runtimeFromParam('css')).toBe('css');
    expect(runtimeFromParam(null)).toBe('css');
    expect(runtimeFromParam('gsap')).toBe('css');
  });

  it('cssHandle puts a native animation behind the same speed, time and cancel as Motion', () => {
    const fake = { playbackRate: 1, currentTime: 250, playState: 'running', cancel() { this.playState = 'idle'; } };
    const handle = cssHandle({} as Element, fake as unknown as Animation);
    expect(handle.time).toBeCloseTo(0.25, 6);
    handle.speed = 0.5;
    expect(fake.playbackRate).toBe(0.5);
    handle.time = 0;
    expect(fake.currentTime).toBe(0);
    expect(handle.finished).toBe(false);
    fake.playState = 'finished';
    expect(handle.finished).toBe(true);
    handle.cancel();
    expect(fake.playState).toBe('idle');
  });
});
