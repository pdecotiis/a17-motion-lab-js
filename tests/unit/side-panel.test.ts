import { describe, it, expect } from 'vitest';
import { resolveTiming, playbackOf, stepsOf, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { motionArgsOf } from '../../lab/lib/motion-args.js';
import { validateVersionMeta } from '../../lab/lib/version-meta.js';
import { pairingWarnings } from '../../lab/lib/token-refs.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, MotionVersion } from '../../lab/lib/types.js';
import { v1, v2, versions } from '../../components/side-panel/motion.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

// The generic tween and spring behaviour the panel's earlier versions showed, on fixtures of their own.
const tween: MotionVersion = {
  id: 'v1', label: 'Slide In', lineage: 'fixture',
  model: { model: 'tween', duration: 'duration.400', easing: 'easing.expressive-entrance' },
  keyframes: [
    { opacity: 0, transform: 'translateX({distance.52})', offset: 0 },
    { opacity: 1, transform: 'translateX(0px)', offset: 1 },
  ],
};
const spring: MotionVersion = {
  id: 'v1', label: 'Slide In, Spring', lineage: 'fixture',
  model: {
    model: 'spring', duration: 'duration.700', easing: 'easing.expressive-entrance', bounce: 'bounce.50',
    properties: [
      { property: 'transform', wrapTransform: 'translateX', unit: 'px', from: 48, to: 0 },
      { property: 'opacity', from: 0, to: 1 },
    ],
  },
};

describe('Side panel motion versions', () => {
  it('every version validates, and the lineage is valid', () => {
    for (const v of versions) expect(() => validateMotionVersion(v), v.id).not.toThrow();
    expect(() => validateVersionMeta(versions)).not.toThrow();
  });

  it('follows the pairing rules', () => {
    for (const v of versions) expect(pairingWarnings(v, raw), v.id).toEqual([]);
  });

  describe('a tween slide', () => {
    it('plays expressive-entrance over duration.400', () => {
      const t = resolveTiming(tween, raw);
      expect(t.duration).toBe(400);
      expect(t.easing).toContain('cubic-bezier');
    });

    it('slides in from distance.52', () => {
      expect(playbackOf(tween, raw).keyframes[0]).toMatchObject({ opacity: 0, transform: 'translateX(52px)' });
    });
  });

  describe('a spring slide', () => {
    it('is a spring with a visible bounce', () => {
      expect(spring.model).toMatchObject({ model: 'spring', bounce: 'bounce.50', duration: 'duration.700' });
    });

    it('CSS plays its from/to values along the easing, with no overshoot', () => {
      const p = playbackOf(spring, raw);
      expect(p.duration).toBe(700);
      expect(p.keyframes).toEqual([
        { offset: 0, transform: 'translateX(48px)', opacity: 0 },
        { offset: 1, transform: 'translateX(0px)', opacity: 1 },
      ]);
    });

    it('Motion plays it as a real spring: its bounce, its duration as the visual duration', () => {
      expect(motionArgsOf(spring, raw).options).toEqual({ type: 'spring', visualDuration: 0.7, bounce: 0.5, delay: 0 });
      expect(motionArgsOf(spring, raw, { globalBounce: 'bounce.0' }).options.bounce).toBe(0.5);
    });
  });

  describe('v1 (Spring, Content Follows)', () => {
    it('moves the panel as a bounce.50 spring and gives the title, the list and the buttons their own motion', () => {
      expect(v1.model).toEqual(spring.model);
      expect(Object.keys(v1.layers!)).toEqual(['title', 'list', 'actions']);
      expect(stepsOf(v1).map(s => playbackOf(s.version, raw).delay).slice(1)).toEqual([80, 120, 120]);
    });

    it('everything is a spring under Motion: the panel keeps its bounce, the layers use the global bounce', () => {
      const [root, ...layers] = stepsOf(v1);
      expect(motionArgsOf(root!.version, raw).options).toMatchObject({ type: 'spring', bounce: 0.5 });
      for (const l of layers) expect(motionArgsOf(l.version, raw).options).toMatchObject({ type: 'spring', bounce: 0.25 });
    });
  });

  describe('v2 (Open / Close)', () => {
    it('is an interaction forked from v1', () => {
      expect(v2.interaction).toBeDefined();
      expect(v2.forkedFrom).toBe('v1');
    });
  });
});
