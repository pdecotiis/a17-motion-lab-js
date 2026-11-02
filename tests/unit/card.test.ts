import { describe, it, expect } from 'vitest';
import { resolveTiming, resolveKeyframes, playbackOf, stepsOf, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
import { v1, v2, v3, v4, v5, versions } from '../../components/card/motion.js';
import { stateNames, hasHoldTriggers, layerNames, timingFor, cssTransitionPlan, motionStates, motionTransitionPlan } from '../../lab/lib/interaction.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateVersionMeta, filterVersions } from '../../lab/lib/version-meta.js';
import { getTokenRefs, pairingWarnings } from '../../lab/lib/token-refs.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('Card motion versions', () => {
  describe('v1 (Fade Up — tween)', () => {
    it('validates with no structural keyframe properties', () => {
      expect(() => validateMotionVersion(v1)).not.toThrow();
    });

    it('produces a numeric duration', () => {
      const t = resolveTiming(v1, raw);
      expect(typeof t.duration).toBe('number');
      expect(t.duration).toBeGreaterThan(0);
    });

    it('plays duration.220 with productive-entrance (220ms)', () => {
      const t = resolveTiming(v1, raw);
      expect(t.duration).toBe(220);
      expect(t.easing).toBe('cubic-bezier(0, 0, 0.38, 0.9)');
    });

    it('names its travel distance as a token, so the keyframes resolve to 16px', () => {
      expect(v1.keyframes![0]!.transform).toBe('translateY({distance.16})');
      expect(resolveKeyframes(v1.keyframes, raw)[0]!.transform).toBe('translateY(16px)');
    });

    it('produces a cubic-bezier easing string', () => {
      const t = resolveTiming(v1, raw);
      expect(t.easing).toContain('cubic-bezier');
    });
  });

  describe('v2 (Scale In — spring)', () => {
    it('validates (non-empty properties array, no disallowed keys)', () => {
      expect(() => validateMotionVersion(v2)).not.toThrow();
    });

    it('plays its from and to values with productive-entrance over duration.300', () => {
      const p = playbackOf(v2, raw);
      expect(p.keyframes).toHaveLength(2);
      expect(p.keyframes[0]).toMatchObject({ transform: 'scale(0.92)', opacity: 0 });
      expect(p.keyframes[1]).toMatchObject({ transform: 'scale(1)', opacity: 1 });
      expect(p.duration).toBe(300);
      expect(p.easing).toContain('cubic-bezier');
    });

    it('never overshoots 1: CSS plays no spring', () => {
      const scales = playbackOf(v2, raw).keyframes
        .map(kf => kf.transform)
        .filter((t): t is string => typeof t === 'string')
        .map(t => parseFloat(t.replace('scale(', '')));
      expect(scales.some(sc => sc > 1.0)).toBe(false);
    });
  });
});

describe('v4 (Fade Up, Text Follows: layers)', () => {
  it('validates, forked from v1', () => {
    expect(() => validateMotionVersion(v4)).not.toThrow();
    expect(v4.forkedFrom).toBe('v1');
  });

  it('moves the card like v1 and gives the title and the text their own motion', () => {
    expect(v4.model).toEqual({ ...v1.model });
    expect(Object.keys(v4.layers!)).toEqual(['title', 'text']);
    expect(stepsOf(v4).map(s => resolveTiming(s.version, raw).delay)).toEqual([0, 70, 120]);
  });

  it('every layer is a layer in the card markup', () => {
    const markup = readFileSync(join(process.cwd(), 'components/card/markup.html'), 'utf8');
    for (const name of Object.keys(v4.layers!)) expect(markup).toContain(`data-motion="${name}"`);
  });
});

describe('Card tokens', () => {
  it('every version uses tokens that exist, with no hard-coded values and no pairing warnings', () => {
    for (const v of versions) {
      const { tokens, hardcoded } = getTokenRefs(v, raw);
      expect(hardcoded, `${v.id} hard-coded values`).toEqual([]);
      expect(tokens.every(t => t in raw), `${v.id} unknown tokens`).toBe(true);
      expect(pairingWarnings(v, raw), `${v.id} pairing`).toEqual([]);
    }
  });

  it('staggers with delay tokens', () => {
    expect(versions.map(v => v.stagger)).toEqual(['delay.70', 'delay.120', 'delay.70', 'delay.70', undefined]);
  });
});

describe('Card status and lineage', () => {
  it('every version has valid status and lineage', () => {
    expect(() => validateVersionMeta(versions)).not.toThrow();
  });

  it('v3 validates and is archived, forked from v1', () => {
    expect(() => validateMotionVersion(v3)).not.toThrow();
    expect(v3.status).toBe('archived');
    expect(v3.forkedFrom).toBe('v1');
  });

  it('archived v3 is hidden from the default version list', () => {
    expect(filterVersions(versions).map(v => v.id)).toEqual(['v1', 'v2', 'v4', 'v5']);
  });
});

describe('v5 (Hover Lift: states, triggers and a layer)', () => {
  const i = v5.interaction!;

  it('validates, has no model of its own, and follows the pairing rules', () => {
    expect(() => validateMotionVersion(v5)).not.toThrow();
    expect(v5.model).toBeUndefined();
    expect(pairingWarnings(v5, raw)).toEqual([]);
    expect(v5.forkedFrom).toBe('v1');
  });

  it('has three states, rest first, and hover and press as triggers on the card', () => {
    expect(stateNames(i)).toEqual(['rest', 'hover', 'pressed']);
    expect(i.triggers).toEqual([{ on: 'hover', state: 'hover' }, { on: 'press', state: 'pressed' }]);
    expect(hasHoldTriggers(i)).toBe(true);
  });

  it('the image is a layer with its own values and its own, slower timing into hover', () => {
    expect(layerNames(i)).toEqual(['image']);
    expect(timingFor(i, null, 'hover')).toMatchObject({ duration: 'duration.220' });
    expect(timingFor(i, 'image', 'hover')).toMatchObject({ duration: 'duration.300' });
    expect(timingFor(i, 'image', 'pressed')).toBe(i.transitions['pressed']);
  });

  it('CSS: hover lifts the card 4px and scales the image 103%; rest puts both back', () => {
    const card = cssTransitionPlan(i, 'hover', raw);
    expect(card.animate).toEqual({ transform: 'translateY(-4px)' });
    expect(card.duration).toBe(220);
    const image = cssTransitionPlan(i, 'hover', raw, { target: 'image' });
    expect(image.animate).toEqual({ transform: 'scale(1.03)' });
    expect(image.duration).toBe(300);
    expect(cssTransitionPlan(i, 'rest', raw, { target: 'image' }).animate).toEqual({ transform: 'none' });
    expect(cssTransitionPlan(i, 'pressed', raw).animate).toEqual({ transform: 'translateY(-4px) scale(0.98)' });
  });

  it('Motion: independent transforms, the same in every state, for the card and for the image', () => {
    expect(motionStates(i, raw)).toEqual({
      rest: { y: 0, scale: 1 }, hover: { y: -4, scale: 1 }, pressed: { y: -4, scale: 0.98 },
    });
    expect(motionStates(i, raw, 'image')).toEqual({ rest: { scale: 1 }, hover: { scale: 1.03 }, pressed: { scale: 1.03 } });
  });

  it('Motion plays the exit with no bounce and the hover with the global bounce', () => {
    expect(motionTransitionPlan(i, 'rest', raw, { globalBounce: 'bounce.50' }).options.bounce).toBe(0);
    expect(motionTransitionPlan(i, 'hover', raw, { globalBounce: 'bounce.50' }).options.bounce).toBe(0.5);
    expect(motionTransitionPlan(i, 'hover', raw, { target: 'image' }).options.visualDuration).toBe(0.3);
  });

  it('names its tokens: the transitions, and the distance and scales its states use', () => {
    const t = getTokenRefs(v5, raw).tokens;
    expect(t).toEqual(expect.arrayContaining(['duration.220', 'duration.100', 'duration.140', 'duration.300', 'easing.productive-standard', 'easing.productive-exit', 'distance.4', 'scale.98', 'bounce.0']));
  });
});
