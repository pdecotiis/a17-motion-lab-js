import { describe, it, expect } from 'vitest';
import { buildVersionCss } from '../../lab/lib/css-output.js';
import { buildGsapCode, buildMotionCode } from '../../lab/lib/export-code.js';
import { buildVersionExport } from '../../lab/lib/spec.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, MotionVersion } from '../../lab/lib/types.js';
import { v2 as panelV2 } from '../../components/side-panel/versions/v2.js';
import { v2 as cardV2 } from '../../components/card/versions/v2.js';
import { versions as cardVersions } from '../../components/card/motion.js';

const tokens = compileTokens(tokensJson as unknown as DtcgGroup);
const { raw } = tokens;
// The shipped card v2 has an entrance and states but no interaction layer; layers are covered on a fixture built from it.
const withImage: MotionVersion = {
  ...cardV2,
  interaction: {
    ...cardV2.interaction!,
    layers: {
      image: {
        states: { hovered: { transform: 'scale(1.03)' }, pressed: { transform: 'scale(1.03)' } },
        transitions: { hovered: { model: 'tween', duration: 'duration.250', easing: 'easing.productive-standard' } },
      },
    },
  },
};
const css = buildVersionCss(withImage, raw, { component: 'card' });
const cardCss = buildVersionCss(cardV2, raw, { component: 'card' });

describe('trigger-aware CSS', () => {
  it('wires hover inside (hover: hover), press as :active, and the layer as a descendant rule', () => {
    expect(css).toMatch(/@media \(hover: hover\) \{[\s\S]*\.motion-card-v2:hover \{[\s\S]*translateY/);
    expect(css).toContain('.motion-card-v2:hover [data-motion="image"] {');
    expect(css).toContain('.motion-card-v2:active {');
    // hover is only inside the media query
    const outside = css.replace(/@media \(hover: hover\) \{[\s\S]*?\n\}\n/, '');
    expect(outside).not.toMatch(/\.motion-card-v2:hover \{/);
  });
  it('gives the layer its own timing and the rest rule the way back', () => {
    expect(css).toMatch(/\.motion-card-v2 \[data-motion="image"\] \{[\s\S]*?transition-duration: var\(--motion-duration-150/);
    expect(css).toMatch(/\.motion-card-v2:hover \[data-motion="image"\] \{[\s\S]*?transition-duration: var\(--motion-duration-250/);
  });
  it('lists every trigger selector in the reduced-motion block', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion'));
    expect(reduced).toContain('.motion-card-v2:hover');
    expect(reduced).toContain('.motion-card-v2:active [data-motion="image"]');
    expect(reduced).toContain('transition: none;');
  });
  it('a focus trigger uses :focus-visible and :has for the inside', () => {
    const f = { ...withImage, interaction: { ...withImage.interaction!, triggers: [{ on: 'focus' as const, state: 'hovered' }, { on: 'hover' as const, state: 'hovered', target: 'image' }] } };
    const out = buildVersionCss(f, raw, { component: 'card' });
    expect(out).toContain('.motion-card-v2:focus-visible');
    expect(out).toContain('.motion-card-v2:has(:focus-visible)');
    expect(out).toContain('.motion-card-v2:has([data-motion="image"]:hover)');
  });
  it('a click-only version has no pseudo-class rules', () => {
    const c = buildVersionCss(panelV2, raw, { component: 'side-panel' });
    expect(c).not.toContain(':hover');
    expect(c).toContain('data-state="open"');
  });
});

describe('GSAP and Motion exports with layers and triggers', () => {
  it('GSAP names each part and says what its triggers do', () => {
    const code = buildGsapCode(withImage, raw, { component: 'card' });
    expect(code).toContain('image: { scale: 1 },');
    expect(code).toContain('image: { scale: 1.03 },');
    expect(code).toContain('const differently = {');
    expect(code).toContain('el.addEventListener("pointerenter"');
    expect(code).not.toContain('export function');
  });
  it('Motion names each part, and attaches the triggers', () => {
    const code = buildMotionCode(withImage, raw, { component: 'card' });
    expect(code).toContain('layer: "image"');
    expect(code).toContain('export function attachCardV2(el)');
    expect(code).toContain('"on":"hover"');
    expect(code).toContain('return () => off.forEach');
  });
  it('a version with no triggers has no trigger code', () => {
    const none = { ...cardV2, interaction: { ...cardV2.interaction!, triggers: undefined } };
    expect(buildGsapCode(none, raw, { component: 'card' })).not.toContain('addEventListener');
    expect(buildMotionCode(none, raw, { component: 'card' })).not.toContain('export function attach');
  });
  it('the generated code listens, and hover goes to hovered then back', () => {
    const code = buildGsapCode(cardV2, raw, { component: 'card' });
    const listeners: { node: unknown; type: string; fn: (e: unknown) => void }[] = [];
    const mkNode = () => ({
      dataset: {} as Record<string, string>,
      addEventListener(type: string, fn: (e: unknown) => void) { listeners.push({ node: this, type, fn }); },
      querySelectorAll: () => [] as unknown[],
    });
    const el = mkNode();
    const gsap = { registerPlugin() {}, set: () => undefined, to: () => ({}), matchMedia: () => ({ add: () => undefined }) };
    new Function('gsap', 'CustomEase', 'window', 'document', code)(
      gsap, { create() {} }, { matchMedia: () => ({ matches: false }) }, { querySelector: () => el, addEventListener() {} },
    );
    const on = (type: string, e: unknown = {}) => listeners.filter(l => l.type === type).forEach(l => l.fn(e));
    expect(el.dataset['state']).toBe('default');
    on('pointerenter', { pointerType: 'mouse' });
    expect(el.dataset['state']).toBe('hovered');
    on('pointerleave');
    expect(el.dataset['state']).toBe('default');
    on('pointerenter', { pointerType: 'touch' });
    expect(el.dataset['state']).toBe('default');
  });
});

describe('spec.md for an interaction version', () => {
  const { markdown: md } = buildVersionExport('card', withImage, cardVersions, tokens);
  it('has a Triggers table, the layer states and the layer timing', () => {
    expect(md).toContain('## Triggers');
    expect(md).toMatch(/\| hover \| the component itself \|/);
    expect(md).toContain('layer `image`');
    expect(md).toContain('has its own timing');
  });
  it('the side panel says its open state is set from outside', () => {
    const { markdown: m } = buildVersionExport('side-panel', panelV2, [panelV2], tokens);
    expect(m).toContain('Set from outside the component');
  });
});

describe('a version with an entrance and states (card v2)', () => {
  it('CSS: the entrance fills backwards so the states can take over, for the card and its layers', () => {
    expect(cardCss).toContain('Add .motion-card-v2 when it should play: the entrance plays, and from then on hover, press and focus work');
    const fills = cardCss.match(/animation-fill-mode: (\w+);/g) ?? [];
    expect(fills).toHaveLength(3); // the card, title and text
    expect(fills.every(f => f === 'animation-fill-mode: backwards;')).toBe(true);
    expect(cardCss).not.toContain('animation-fill-mode: both');
    expect(cardCss).toContain('.motion-card-v2-title {');
  });
  it('CSS: hover is inside @media (hover: hover), press is :active', () => {
    expect(cardCss).toMatch(/@media \(hover: hover\) \{[\s\S]*\.motion-card-v2:hover \{[\s\S]*translateY/);
    expect(cardCss).toContain('.motion-card-v2:active {');
    expect(cardCss).not.toContain('[data-motion="image"]');
  });
  it('GSAP: the entrance, the states and the triggers in one file, read top to bottom', () => {
    const code = buildGsapCode(cardV2, raw, { component: 'card' });
    expect(code).toContain('// entrance');
    expect(code).toContain('const states = {');
    expect(code).toContain('function show(state) {');
    expect(code.indexOf('// entrance')).toBeLessThan(code.indexOf('const states = {'));
    expect(code).toContain('// triggers');
    expect(code).not.toContain('export function');
    expect(code.match(/^import /gm)).toBeNull();
    const creates = code.match(/^CustomEase\.create\(.*$/gm) ?? [];
    expect(new Set(creates).size).toBe(creates.length);
    expect(code.match(/^\/\/ Tokens:/gm)).toHaveLength(1);
    expect(code).toContain('distance.4');
  });
  it('Motion: play and attach in one file with one import', () => {
    const code = buildMotionCode(cardV2, raw, { component: 'card' });
    expect(code).toContain('export function playCardV2(el');
    expect(code).toContain('export function attachCardV2(el)');
    expect(code).toContain('export function goToCardV2(el, state)');
    expect(code).toContain('Promise.all(playCardV2(el)).then(() => attachCardV2(el))');
    expect(code.match(/^import /gm)).toHaveLength(1);
    expect(code.match(/^\/\/ Tokens:/gm)).toHaveLength(1);
  });
  it('spec.md has the entrance, its layers, the triggers and the states', () => {
    const { markdown: md } = buildVersionExport('card', cardV2, cardVersions, tokens);
    for (const h of ['## Triggers', '## On appear: what animates', '## On appear: timing', '## Layer: title', '## Layer: text', '## States', '## Transitions']) expect(md).toContain(h);
    expect(md).toContain('The entrance plays first');
    expect(md.indexOf('## On appear: what animates')).toBeLessThan(md.indexOf('## States'));
  });
});
