import { describe, it, expect } from 'vitest';
import { resolveTiming, resolveKeyframes, playbackOf, stepsOf, validateMotionVersion, hasEntrance } from '../../lab/lib/motion-models.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, MotionVersion } from '../../lab/lib/types.js';
import cardModule, { v1, v2, versions } from '../../components/card/motion.js';
import { stateNames, hasHoldTriggers, layerNames, timingFor, cssTransitionPlan, motionStates, motionTransitionPlan } from '../../lab/lib/interaction.js';
import { v2 as sidePanelV2 } from '../../components/side-panel/versions/v2.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateVersionMeta } from '../../lab/lib/version-meta.js';
import { getStepRefs, getTokenRefs, pairingWarnings } from '../../lab/lib/token-refs.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

// The generic tween and spring behaviour the card's earlier versions showed, on fixtures of their own.
const fadeUp: MotionVersion = {
  id: 'v1', label: 'Fade Up', lineage: 'fixture',
  model: { model: 'tween', duration: 'duration.220', easing: 'easing.productive-entrance', delay: '0ms' },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.16})', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
};
const scaleIn: MotionVersion = {
  id: 'v1', label: 'Scale In', lineage: 'fixture',
  model: {
    model: 'spring', duration: 'duration.300', easing: 'easing.productive-entrance', bounce: 'bounce.0',
    properties: [
      { property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1 },
      { property: 'opacity', from: 0, to: 1 },
    ],
  },
};

describe('Card motion models', () => {
  describe('a fade-up tween', () => {
    it('validates with no structural keyframe properties', () => {
      expect(() => validateMotionVersion(fadeUp)).not.toThrow();
    });

    it('produces a numeric duration', () => {
      const t = resolveTiming(fadeUp, raw);
      expect(typeof t.duration).toBe('number');
      expect(t.duration).toBeGreaterThan(0);
    });

    it('plays duration.220 with productive-entrance (220ms)', () => {
      const t = resolveTiming(fadeUp, raw);
      expect(t.duration).toBe(220);
      expect(t.easing).toBe('cubic-bezier(0, 0, 0.38, 0.9)');
    });

    it('names its travel distance as a token, so the keyframes resolve to 16px', () => {
      expect(fadeUp.keyframes![0]!.transform).toBe('translateY({distance.16})');
      expect(resolveKeyframes(fadeUp.keyframes, raw)[0]!.transform).toBe('translateY(16px)');
    });

    it('produces a cubic-bezier easing string', () => {
      const t = resolveTiming(fadeUp, raw);
      expect(t.easing).toContain('cubic-bezier');
    });
  });

  describe('a scale-in spring', () => {
    it('validates (non-empty properties array, no disallowed keys)', () => {
      expect(() => validateMotionVersion(scaleIn)).not.toThrow();
    });

    it('plays its from and to values with productive-entrance over duration.300', () => {
      const p = playbackOf(scaleIn, raw);
      expect(p.keyframes).toHaveLength(2);
      expect(p.keyframes[0]).toMatchObject({ transform: 'scale(0.92)', opacity: 0 });
      expect(p.keyframes[1]).toMatchObject({ transform: 'scale(1)', opacity: 1 });
      expect(p.duration).toBe(300);
      expect(p.easing).toContain('cubic-bezier');
    });

    it('never overshoots 1: CSS plays no spring', () => {
      const scales = playbackOf(scaleIn, raw).keyframes
        .map(kf => kf.transform)
        .filter((t): t is string => typeof t === 'string')
        .map(t => parseFloat(t.replace('scale(', '')));
      expect(scales.some(sc => sc > 1.0)).toBe(false);
    });
  });
});

describe('v1 (Fade Up, Text Follows: layers)', () => {
  it('validates, and is the first version', () => {
    expect(() => validateMotionVersion(v1)).not.toThrow();
    expect(v1.forkedFrom).toBeUndefined();
    expect(v1.lineage).toBeTruthy();
  });

  it('moves the card like a fade-up and gives the title and the text their own motion', () => {
    expect(v1.model).toEqual(fadeUp.model);
    expect(Object.keys(v1.layers!)).toEqual(['title', 'text']);
    expect(stepsOf(v1).map(s => resolveTiming(s.version, raw).delay)).toEqual([0, 70, 120]);
  });

  it('every layer is a layer in the card markup', () => {
    const markup = readFileSync(join(process.cwd(), 'components/card/markup.html'), 'utf8');
    for (const name of Object.keys(v1.layers!)) expect(markup).toContain(`data-motion="${name}"`);
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
    expect(versions.map(v => v.stagger)).toEqual(['delay.70', 'delay.70']);
  });
});

describe('Card status and lineage', () => {
  it('every version has lineage, and the component has a valid status', () => {
    expect(() => validateVersionMeta(versions, cardModule.status)).not.toThrow();
  });

  it('keeps the last two versions, numbered without gaps', () => {
    expect(versions.map(v => v.id)).toEqual(['v1', 'v2']);
  });
});

// The shipped v2 has no interaction layer; interaction layers stay covered by a fixture built from it.
const withImage: MotionVersion = {
  ...v2,
  interaction: {
    ...v2.interaction!,
    layers: {
      image: {
        states: { hover: { transform: 'scale({scale.103})' }, pressed: { transform: 'scale({scale.103})' } },
        transitions: { hover: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-standard' } },
      },
    },
  },
};

describe('v2 (Hover Lift: v1\'s entrance, then states and triggers)', () => {
  const i = v2.interaction!;

  it('validates, has an entrance as well as states, and follows the pairing rules', () => {
    expect(() => validateMotionVersion(v2)).not.toThrow();
    expect(hasEntrance(v2)).toBe(true);
    expect(v2.model).toEqual(v1.model);
    expect(v2.stagger).toBe('delay.70');
    expect(v2.trigger).toBeUndefined();
    expect(pairingWarnings(v2, raw)).toEqual([]);
    expect(v2.forkedFrom).toBe('v1');
  });

  it('its steps are the entrance (the card, title and text) and carry no interaction', () => {
    const steps = stepsOf(v2);
    expect(steps.map(s => s.name)).toEqual([null, 'title', 'text']);
    expect(steps.every(s => s.version.interaction === undefined)).toBe(true);
  });

  it('has three states, rest first, and hover and press as triggers on the card', () => {
    expect(stateNames(i)).toEqual(['rest', 'hover', 'pressed']);
    expect(i.triggers).toEqual([{ on: 'hover', state: 'hover' }, { on: 'press', state: 'pressed' }]);
    expect(hasHoldTriggers(i)).toBe(true);
    expect(layerNames(i)).toEqual([]);
  });

  it('hover only moves up 4px; press adds the scale; rest is the quick way back', () => {
    expect(cssTransitionPlan(i, 'hover', raw).animate).toEqual({ transform: 'translateY(-4px)' });
    expect(cssTransitionPlan(i, 'hover', raw).duration).toBe(220);
    expect(cssTransitionPlan(i, 'pressed', raw).animate).toEqual({ transform: 'translateY(-4px) scale(0.98)' });
    expect(motionStates(i, raw)).toEqual({
      rest: { y: 0, scale: 1 }, hover: { y: -4, scale: 1 }, pressed: { y: -4, scale: 0.98 },
    });
  });

  it('Motion plays the exit with no bounce and the hover with the global bounce', () => {
    expect(motionTransitionPlan(i, 'rest', raw, { globalBounce: 'bounce.50' }).options.bounce).toBe(0);
    expect(motionTransitionPlan(i, 'hover', raw, { globalBounce: 'bounce.50' }).options.bounce).toBe(0.5);
  });

  it('names its tokens: the entrance, the transitions, and the distance and scale its states use', () => {
    const t = getTokenRefs(v2, raw).tokens;
    expect(t).toEqual(expect.arrayContaining(['duration.220', 'duration.100', 'duration.140', 'duration.300', 'easing.productive-entrance', 'easing.productive-standard', 'easing.productive-exit', 'distance.16', 'distance.4', 'scale.98', 'bounce.0']));
    const groups = getStepRefs(v2, raw);
    expect(groups.map(g => g.layer)).toEqual([null, 'title', 'text', 'states']);
  });

  it('pairing warnings cover the entrance and the states', () => {
    const slowEntrance = { ...v2, model: { ...v2.model!, duration: 'duration.560' } } as MotionVersion;
    const slowHover = { ...v2, interaction: { ...v2.interaction!, transitions: { ...v2.interaction!.transitions, hover: { model: 'tween', duration: 'duration.560', easing: 'easing.productive-standard' } } } } as MotionVersion;
    expect(pairingWarnings(slowEntrance, raw).some(w => w.includes('productive-entrance') && w.includes('560ms'))).toBe(true);
    expect(pairingWarnings(slowHover, raw).some(w => w.startsWith('into hover:') && w.includes('560ms'))).toBe(true);
  });

  it('only a version with a model has an entrance', () => {
    expect(hasEntrance(sidePanelV2)).toBe(false);
    expect(hasEntrance(v1)).toBe(true);
  });

  it('an interaction layer keeps its own values and timing (fixture)', () => {
    const li = withImage.interaction!;
    expect(validateMotionVersion(withImage)).toBeUndefined();
    expect(layerNames(li)).toEqual(['image']);
    expect(timingFor(li, 'image', 'hover')).toMatchObject({ duration: 'duration.300' });
    expect(timingFor(li, 'image', 'pressed')).toBe(li.transitions['pressed']);
    expect(cssTransitionPlan(li, 'hover', raw, { target: 'image' }).animate).toEqual({ transform: 'scale(1.03)' });
    expect(cssTransitionPlan(li, 'hover', raw, { target: 'image' }).duration).toBe(300);
    expect(cssTransitionPlan(li, 'rest', raw, { target: 'image' }).animate).toEqual({ transform: 'none' });
    expect(motionStates(li, raw, 'image')).toEqual({ rest: { scale: 1 }, hover: { scale: 1.03 }, pressed: { scale: 1.03 } });
    expect(motionTransitionPlan(li, 'hover', raw, { target: 'image' }).options.visualDuration).toBe(0.3);
  });
});
