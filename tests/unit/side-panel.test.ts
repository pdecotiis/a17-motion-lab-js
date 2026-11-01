import { describe, it, expect } from 'vitest';
import { resolveTiming, playbackOf, stepsOf, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { motionArgsOf } from '../../lab/lib/motion-args.js';
import { validateVersionMeta } from '../../lab/lib/version-meta.js';
import { pairingWarnings } from '../../lab/lib/token-refs.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
import { v1, v2, v3, versions } from '../../components/side-panel/motion.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('Side panel motion versions', () => {
  it('every version validates, and the lineage is valid', () => {
    for (const v of versions) expect(() => validateMotionVersion(v), v.id).not.toThrow();
    expect(() => validateVersionMeta(versions)).not.toThrow();
  });

  it('follows the pairing rules', () => {
    for (const v of versions) expect(pairingWarnings(v, raw), v.id).toEqual([]);
  });

  describe('v1 (Slide In, tween)', () => {
    it('plays expressive-entrance over duration.400', () => {
      const t = resolveTiming(v1, raw);
      expect(t.duration).toBe(400);
      expect(t.easing).toContain('cubic-bezier');
    });

    it('slides in from distance.48', () => {
      expect(playbackOf(v1, raw).keyframes[0]).toMatchObject({ opacity: 0, transform: 'translateX(48px)' });
    });
  });

  describe('v2 (Slide In, Spring)', () => {
    it('is a spring with a visible bounce', () => {
      expect(v2.model).toMatchObject({ model: 'spring', bounce: 0.5, duration: 'duration.560' });
    });

    it('CSS plays its from/to values along the easing, with no overshoot', () => {
      const p = playbackOf(v2, raw);
      expect(p.duration).toBe(560);
      expect(p.keyframes).toEqual([
        { offset: 0, transform: 'translateX(48px)', opacity: 0 },
        { offset: 1, transform: 'translateX(0px)', opacity: 1 },
      ]);
    });

    it('Motion plays it as a real spring: its bounce, its duration as the visual duration', () => {
      expect(motionArgsOf(v2, raw).options).toEqual({ type: 'spring', visualDuration: 0.56, bounce: 0.5, delay: 0 });
    });
  });

  describe('v3 (Spring, Content Follows)', () => {
    it('moves the panel like v2 and gives the title, the list and the buttons their own motion', () => {
      expect(v3.model).toEqual(v2.model);
      expect(Object.keys(v3.layers!)).toEqual(['title', 'list', 'actions']);
      expect(stepsOf(v3).map(s => playbackOf(s.version, raw).delay).slice(1)).toEqual([70, 120, 120]);
    });

    it('everything is a spring under Motion: the panel bounces, the layers have no bounce', () => {
      const [root, ...layers] = stepsOf(v3);
      expect(motionArgsOf(root!.version, raw).options).toMatchObject({ type: 'spring', bounce: 0.5 });
      for (const l of layers) expect(motionArgsOf(l.version, raw).options).toMatchObject({ type: 'spring', bounce: 0 });
    });
  });
});
