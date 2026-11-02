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
  model: { model: 'spring', duration: 'duration.560', easing: 'easing.expressive-bounce', bounce: 0.25, properties },
  forkedFrom: 'v1',
  ...over,
});

const mixedSpring = spring([
  { property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1 },
  { property: 'opacity', from: 0, to: 1 },
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
  it('has no real spring in CSS: it plays from and to with the easing curve, with no linear() curve', () => {
    const css = buildVersionCss(mixedSpring, raw, { component: 'card' });
    expect(css).not.toContain('linear(');
    expect(css).toContain('animation-duration: var(--motion-duration-560, 560ms);');
    expect(css).toContain('animation-timing-function: var(--motion-easing-expressive-bounce, cubic-bezier(');
    expect(css).toMatch(/from \{[^}]*opacity: 0;[^}]*transform: scale\(0\.92\);/);
    expect(css).toMatch(/to \{[^}]*opacity: 1;[^}]*transform: scale\(1\);/);
  });

  it('says it was authored as a spring and which easing CSS plays', () => {
    const css = buildVersionCss(mixedSpring, raw, { component: 'card' });
    expect(css).toContain('/* authored as a spring of easing.expressive-bounce; CSS plays its easing, only a spring runtime (Motion) bounces */');
  });

  it('is one animation, whatever the properties', () => {
    const css = buildVersionCss(mixedSpring, raw, { component: 'card' });
    expect(css).toContain('animation-name: motion-card-v2;');
    expect(css).not.toContain('-linear');
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

  it('a spring version exports its easing and says it was authored as a spring', () => {
    const springOut = buildVersionExport('card', mixedSpring, [mixedSpring], tokens);
    expect(springOut.css).not.toContain('linear(');
    expect(springOut.markdown).toContain('- Duration: duration.560 (560ms)');
    expect(springOut.markdown).toContain('- Easing: easing.expressive-bounce');
    expect(springOut.markdown).toContain('Authored as a spring');
    expect(springOut.markdown).not.toContain('linear() curve');
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

describe('layers', () => {
  const rise = (offset: string): Keyframe[] => [
    { opacity: 0, transform: `translateY({distance.${offset}})`, offset: 0 },
    { opacity: 1, transform: 'translateY(0px)', offset: 1 },
  ];
  const layered = tween({
    status: 'approved',
    stagger: 'delay.70',
    layers: {
      title: { model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance', delay: 'delay.70' }, keyframes: rise('8') },
      text: { model: { model: 'tween', duration: 'duration.140', easing: 'easing.productive-standard', delay: 'delay.120' }, keyframes: rise('12') },
    },
  });
  const css = buildVersionCss(layered, raw, { component: 'card' });

  it('the root keeps its class and each layer gets its own, with its own keyframes', () => {
    expect(css).toContain('.motion-card-v1 {');
    expect(css).toContain('.motion-card-v1-title {');
    expect(css).toContain('.motion-card-v1-text {');
    expect(css).toContain('@keyframes motion-card-v1-title {');
    expect(css).toContain('animation-name: motion-card-v1-text;');
  });

  it('says which element each layer class goes on', () => {
    expect(css).toContain('/* Layer title: add .motion-card-v1-title to the element marked data-motion="title" when the trigger fires. */');
  });

  it('each layer uses its own tokens', () => {
    const title = css.slice(css.indexOf('.motion-card-v1-title {'));
    expect(title).toContain('animation-duration: var(--motion-duration-300, 300ms);');
    const text = css.slice(css.indexOf('.motion-card-v1-text {'));
    expect(text).toContain('animation-duration: var(--motion-duration-140, 140ms);');
    expect(text).toContain('animation-timing-function: var(--motion-easing-productive-standard,');
    expect(css.slice(css.indexOf('@keyframes motion-card-v1-text {'))).toContain('translateY(var(--motion-distance-12, 12px))');
  });

  it('a layer is offset by its own delay and by the version\'s stagger', () => {
    expect(css).toContain('animation-delay: calc(70ms + var(--motion-index, 0) * var(--motion-delay-70, 70ms));');
    expect(css).toContain('animation-delay: calc(120ms + var(--motion-index, 0) * var(--motion-delay-70, 70ms));');
  });

  it('every layer has its own reduced-motion block', () => {
    expect(css.match(/@media \(prefers-reduced-motion: reduce\)/g)).toHaveLength(3);
    expect(css).toContain('@keyframes motion-card-v1-title-reduced {');
  });

  it('a version with no layers is unchanged', () => {
    const plain = buildVersionCss(tween(), raw, { component: 'card' });
    expect(plain).not.toContain('Layer');
    expect(plain.match(/@media/g)).toHaveLength(1);
  });

  describe('spec.md and tokens.css', () => {
    const out = buildVersionExport('card', layered, [layered], tokens);

    it('describes each layer on its own: where it goes, what animates, its timing', () => {
      expect(out.markdown).toContain('## Layer: title');
      expect(out.markdown).toContain('Add `.motion-card-v1-title` to the element marked `data-motion="title"`.');
      expect(out.markdown).toContain('## Layer: text');
      expect(out.markdown).toContain("The component's root element");
      const text = out.markdown.slice(out.markdown.indexOf('## Layer: text'));
      expect(text).toContain('- Duration: duration.140 (140ms)');
      expect(text).toContain('- Delay: delay.120 (120ms)');
      expect(text).toContain('- 0%: opacity 0, transform translateY(12px)');
    });

    it('a layer does not repeat the stagger, which belongs to the whole component', () => {
      expect(out.markdown.match(/- Stagger:/g)).toHaveLength(1);
    });

    it('lists the tokens by motion, with where each one sits', () => {
      const tokensSection = out.markdown.slice(out.markdown.indexOf('## Tokens'));
      expect(tokensSection).toContain('- **root**');
      expect(tokensSection).toContain('- **title**');
      expect(tokensSection).toContain('  - `duration.140` (duration)');
      expect(tokensSection).toContain('  - `distance.12` (0% transform)');
    });

    it('tokens.css defines the variables the layers use too', () => {
      expect(out.tokensCss).toContain('--motion-duration-140: 140ms;');
      expect(out.tokensCss).toContain('--motion-distance-12: 12px;');
      expect(out.tokensCss).toContain('--motion-delay-120: 120ms;');
    });

    it('says how to use the layer classes', () => {
      expect(out.markdown).toContain("and each layer's class (above) to its element");
    });

    it('a version with no layers lists tokens flat, as before', () => {
      const plain = buildVersionExport('card', tween(), [tween()], tokens).markdown;
      expect(plain).not.toContain('## Layer');
      expect(plain).not.toContain('- **root**');
      expect(plain).toContain('- `duration.220` (duration)');
    });
  });
});
