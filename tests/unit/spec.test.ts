import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateMotionVersion } from '../../lab/lib/motion-models.js';
import { buildVersionCss } from '../../lab/lib/css-output.js';
import { buildVersionExport } from '../../lab/lib/spec.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import { describeTrigger, getReducedMotionPolicy, forkVersion } from '../../lab/lib/version-meta.js';
import { getEffectiveDuration, REDUCED_MOTION_FADE_MS } from '../../lab/lib/reduced-motion.js';
import { versions as cardVersions } from '../../components/card/motion.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, MotionVersion, SpringProperty } from '../../lab/lib/types.js';

const tokens = compileTokens(tokensJson as unknown as DtcgGroup);
const { raw } = tokens;

const tween = (over: Partial<MotionVersion> = {}): MotionVersion => ({
  id: 'v1',
  label: 'Fade Up',
  model: { model: 'tween', duration: 'duration.220', easing: 'easing.productive-entrance' },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.16})', offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ],
  lineage: 'imported from test',
  ...over,
});

const spring = (properties: SpringProperty[], over: Partial<MotionVersion> = {}): MotionVersion => ({
  id: 'v2',
  label: 'Scale In',
  model: { model: 'spring', duration: 'duration.560', easing: 'easing.expressive-bounce', properties },
  forkedFrom: 'v1',
  ...over,
});

const mixedSpring = spring([
  { property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1, useSpring: true },
  { property: 'opacity', from: 0, to: 1, useSpring: false },
]);

describe('trigger and reduced-motion metadata', () => {
  it('accepts every trigger type and both reduced-motion policies', () => {
    for (const on of ['load', 'in-view', 'hover', 'click', 'route-change'] as const) {
      expect(() => validateMotionVersion(tween({ trigger: { on } }))).not.toThrow();
    }
    expect(() => validateMotionVersion(tween({ reducedMotion: 'fade' }))).not.toThrow();
    expect(() => validateMotionVersion(tween({ reducedMotion: 'none' }))).not.toThrow();
  });

  it('rejects an unknown trigger or reduced-motion policy', () => {
    expect(() => validateMotionVersion(tween({ trigger: { on: 'scroll' as never } }))).toThrow(/unknown trigger "scroll"/);
    expect(() => validateMotionVersion(tween({ reducedMotion: 'slow' as never }))).toThrow(/unknown reducedMotion "slow"/);
  });

  it('allows a threshold only for in-view, between 0 and 1', () => {
    expect(() => validateMotionVersion(tween({ trigger: { on: 'in-view', threshold: 0.2 } }))).not.toThrow();
    expect(() => validateMotionVersion(tween({ trigger: { on: 'hover', threshold: 0.2 } }))).toThrow(/only applies to "in-view"/);
    expect(() => validateMotionVersion(tween({ trigger: { on: 'in-view', threshold: 1.5 } }))).toThrow(/0 to 1/);
  });

  it('requires once to be a boolean', () => {
    expect(() => validateMotionVersion(tween({ trigger: { on: 'load', once: 'yes' as never } }))).toThrow(/"once"/);
  });

  it('describes a trigger in words, and null when there is none', () => {
    expect(describeTrigger(undefined)).toBeNull();
    expect(describeTrigger({ on: 'hover' })).toBe('On hover');
    expect(describeTrigger({ on: 'in-view', threshold: 0.2, once: true }))
      .toBe('When scrolled into view (20% visible, first time only)');
  });

  it('defaults to fade, and a fork keeps the parent trigger and policy', () => {
    expect(getReducedMotionPolicy(tween())).toBe('fade');
    const parent = tween({ trigger: { on: 'in-view', once: true }, reducedMotion: 'none' });
    const fork = forkVersion(parent, 'v2', 'Copy');
    expect(fork.trigger).toEqual({ on: 'in-view', once: true });
    expect(fork.reducedMotion).toBe('none');
  });
});

describe('reduced-motion runtime', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('caps duration at the fade length when reduced, and leaves it alone otherwise', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    expect(getEffectiveDuration(600)).toBe(REDUCED_MOTION_FADE_MS);
    expect(getEffectiveDuration(100)).toBe(100);
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(getEffectiveDuration(600)).toBe(600);
  });
});

describe('buildVersionCss: tween', () => {
  const css = buildVersionCss(tween({ stagger: '80ms' }), raw, { component: 'card' });

  it('names the keyframes and class after the component and version', () => {
    expect(css).toContain('@keyframes motion-card-v1 {');
    expect(css).toContain('.motion-card-v1 {');
    expect(css).toContain('animation-name: motion-card-v1;');
  });

  it('uses token custom properties with the literal value as fallback', () => {
    expect(css).toContain('animation-duration: var(--motion-duration-220, 220ms);');
    expect(css).toContain('animation-timing-function: var(--motion-easing-productive-entrance, cubic-bezier(0, 0, 0.38, 0.9));');
  });

  it('writes literal values for hard-coded timing', () => {
    const literal = buildVersionCss(tween({ model: { model: 'tween', duration: '240ms', easing: 'ease-in' } }), raw);
    expect(literal).toContain('animation-duration: 240ms;');
    expect(literal).toContain('animation-timing-function: ease-in;');
  });

  it('staggers with an index the developer sets', () => {
    expect(css).toContain('animation-delay: calc(var(--motion-index, 0) * 80ms);');
  });

  it('a stagger that is a delay token uses its custom property', () => {
    const staggered = buildVersionCss(tween({ stagger: 'delay.70' }), raw, { component: 'card' });
    expect(staggered).toContain('animation-delay: calc(var(--motion-index, 0) * var(--motion-delay-70, 70ms));');
  });

  it('keeps every keyframe, in offset order, with kebab-case properties', () => {
    const multi = buildVersionCss(tween({
      keyframes: [
        { opacity: 1, clipPath: 'inset(0)', offset: 1 },
        { opacity: 0, clipPath: 'inset(0 0 100% 0)', offset: 0 },
        { opacity: 0.5, offset: 0.4, easing: 'ease-in' },
      ],
    }), raw, { component: 'card' });
    expect(multi.indexOf('0% {')).toBeLessThan(multi.indexOf('40% {'));
    expect(multi.indexOf('40% {')).toBeLessThan(multi.indexOf('100% {'));
    expect(multi).toContain('clip-path: inset(0 0 100% 0);');
    expect(multi).toContain('animation-timing-function: ease-in;');
  });

  it('says when no trigger is specified, and states it when there is one', () => {
    expect(css).toContain('trigger not specified');
    const withTrigger = buildVersionCss(tween({ trigger: { on: 'in-view', threshold: 0.2, once: true } }), raw, { component: 'card' });
    expect(withTrigger).toContain('Plays: When scrolled into view (20% visible, first time only). Add .motion-card-v1');
  });

  it('writes the reduced-motion fade: opacity only, capped at the fade length', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('@keyframes motion-card-v1-reduced');
    expect(reduced).toContain('opacity: 0;');
    expect(reduced).not.toContain('transform');
    expect(reduced).toContain(`animation-duration: ${REDUCED_MOTION_FADE_MS}ms;`);
  });

  it('turns animation off for reducedMotion "none", or when there is no opacity to fade', () => {
    const none = buildVersionCss(tween({ reducedMotion: 'none' }), raw);
    expect(none.slice(none.indexOf('@media'))).toContain('animation: none;');
    const noOpacity = buildVersionCss(tween({ keyframes: [{ transform: 'scale(0.9)', offset: 0 }, { transform: 'scale(1)', offset: 1 }] }), raw);
    expect(noOpacity.slice(noOpacity.indexOf('@media'))).toContain('animation: none;');
  });

  it('never shortens the reduced fade past a faster version duration', () => {
    const fast = buildVersionCss(tween({ model: { model: 'tween', duration: '100ms', easing: 'ease' } }), raw);
    expect(fast.slice(fast.indexOf('@media'))).toContain('animation-duration: 100ms;');
  });
});

describe('buildVersionCss: spring', () => {
  it('ships the spring as one linear() curve, with no cubic-bezier fallback or @supports block', () => {
    const css = buildVersionCss(mixedSpring, raw, { component: 'card' });
    expect(css).toMatch(/animation-timing-function: linear\(0,/);
    expect(css).not.toContain('@supports');
    expect(css).not.toContain('cubic-bezier');
    expect(css).not.toContain('fallback');
  });

  it('says which easing it plays as a spring, with its bounce and derived duration', () => {
    const css = buildVersionCss(mixedSpring, raw, { component: 'card' });
    expect(css).toContain('/* spring of easing.expressive-bounce: bounce 0.25, 683ms (560ms / 0.82) */');
  });

  it('splits spring and linear properties into two animations so opacity does not overshoot', () => {
    const css = buildVersionCss(mixedSpring, raw, { component: 'card' });
    expect(css).toContain('animation-name: motion-card-v2, motion-card-v2-linear;');
    expect(css).toContain('@keyframes motion-card-v2-linear {');
    expect(css).toMatch(/animation-timing-function: linear\(0,[^;]*, linear;/);
  });

  it('keeps one animation when spring and linear parts both animate transform', () => {
    const both = spring([
      { property: 'transform', wrapTransform: 'scale', from: 0.9, to: 1, useSpring: true },
      { property: 'transform', wrapTransform: 'translateY', from: 8, to: 0, unit: 'px', useSpring: false },
    ]);
    const css = buildVersionCss(both, raw, { component: 'card' });
    expect(css).toContain('animation-name: motion-card-v2;');
    expect(css).toContain('share the spring curve');
  });

  it('a spring with only linear properties is linear, not a spring curve', () => {
    const css = buildVersionCss(spring([{ property: 'opacity', from: 0, to: 1, useSpring: false }]), raw, { component: 'card' });
    expect(css).toContain('animation-timing-function: linear;');
    expect(css).not.toContain('linear(0');
  });

  it('a spring with an easing that has no spring form throws, naming the easing', () => {
    const exit = spring([{ property: 'opacity', from: 0, to: 1 }], { model: { model: 'spring', duration: 'duration.300', easing: 'easing.productive-exit', properties: [{ property: 'opacity', from: 0, to: 1 }] } });
    expect(() => buildVersionCss(exit, raw, { component: 'card' })).toThrow('easing.productive-exit');
  });
});

describe('buildVersionExport', () => {
  const approved = tween({ status: 'approved', stagger: '80ms', trigger: { on: 'in-view', threshold: 0.2, once: true } });
  const out = buildVersionExport('card', approved, [approved], tokens);

  it('writes the spec sections a developer needs', () => {
    for (const heading of ['# card v1: Fade Up', '## When it plays', '## What animates', '## Timing', '## Reduced motion', '## Using it', '## Tokens', '## Not covered by this spec']) {
      expect(out.markdown).toContain(heading);
    }
  });

  it('states the trigger, the timing tokens with values, and the reduced-motion rule', () => {
    expect(out.markdown).toContain('When scrolled into view (20% visible, first time only)');
    expect(out.markdown).toContain('Duration: duration.220 (220ms)');
    expect(out.markdown).toContain('Easing: easing.productive-entrance (cubic-bezier(0, 0, 0.38, 0.9))');
    expect(out.markdown).toContain('Fade only, no movement.');
    expect(out.markdown).toContain('Set `--motion-index');
  });

  it('flags a missing trigger instead of guessing one', () => {
    const noTrigger = buildVersionExport('card', tween(), [tween()], tokens);
    expect(noTrigger.markdown).toContain('**Not specified.**');
  });

  it('flags versions that are not approved', () => {
    expect(out.markdown).not.toContain('not approved yet');
    const review = buildVersionExport('card', tween({ status: 'review' }), [tween()], tokens);
    expect(review.markdown).toContain('not approved yet');
  });

  it('tokens.css holds only the custom properties the version uses', () => {
    expect(out.tokensCss).toContain('--motion-duration-220: 220ms;');
    expect(out.tokensCss).toContain('--motion-easing-productive-entrance: cubic-bezier(0, 0, 0.38, 0.9);');
    expect(out.tokensCss).toContain('--motion-distance-16: 16px;');
    expect(out.tokensCss).not.toContain('duration-400');
  });

  it('a spring version exports its spring, not a fallback', () => {
    const springOut = buildVersionExport('card', mixedSpring, [mixedSpring], tokens);
    expect(springOut.css).toContain('linear(0');
    expect(springOut.markdown).toContain('- Duration: duration.560 (560ms)');
    expect(springOut.markdown).toContain('- Easing: easing.expressive-bounce');
    expect(springOut.markdown).toContain('Plays as a spring: bounce 0.25 (bounce.25), a spring duration of 683ms (the duration / 0.82)');
    expect(springOut.markdown).toContain('Settles in about');
    expect(springOut.markdown).not.toContain('allback');
    expect(springOut.tokensCss).toContain('--motion-bounce-25: 0.25;');
  });

  it('exports every card version without throwing', () => {
    for (const v of cardVersions) {
      expect(() => buildVersionExport('card', v, cardVersions, tokens)).not.toThrow();
    }
  });
});

describe('keyframes that name tokens', () => {
  const kf = tween({
    keyframes: [
      { opacity: '{opacity.56}', transform: 'translateY(-{distance.16}) scale({scale.95})', offset: 0 },
      { opacity: 1, transform: 'translateY(0px)', offset: 1 },
    ],
  });

  it('the CSS uses each token\'s custom property with the value as fallback, and a negative becomes calc', () => {
    const css = buildVersionCss(kf, raw, { component: 'card' });
    expect(css).toContain('opacity: var(--motion-opacity-56, 0.56);');
    expect(css).toContain('transform: translateY(calc(-1 * var(--motion-distance-16, 16px))) scale(var(--motion-scale-95, 0.95));');
  });

  it('the reduced-motion fade uses the opacity token too', () => {
    const css = buildVersionCss(kf, raw, { component: 'card' });
    expect(css.slice(css.indexOf('@media'))).toContain('opacity: var(--motion-opacity-56, 0.56);');
  });

  it('spec.md shows the resolved values; tokens.css defines the variables the keyframes use', () => {
    const { markdown, tokensCss } = buildVersionExport('card', kf, [kf], tokens);
    expect(markdown).toContain('translateY(-16px) scale(0.95)');
    expect(tokensCss).toContain('--motion-opacity-56: 0.56;');
    expect(tokensCss).toContain('--motion-scale-95: 0.95;');
    expect(tokensCss).toContain('--motion-distance-16: 16px;');
  });

  it('a reference to a token that does not exist throws', () => {
    expect(() => buildVersionCss(tween({ keyframes: [{ transform: 'translateY({distance.99})' }, { transform: 'none' }] }), raw)).toThrow('{distance.99}');
  });
});
