import { describe, it, expect } from 'vitest';
import { buildVersionCss } from '../../lab/lib/css-output.js';
import { buildGsapCode, buildMotionCode } from '../../lab/lib/export-code.js';
import { buildVersionExport } from '../../lab/lib/spec.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
import { v4 } from '../../components/side-panel/versions/v4.js';
import { v5 } from '../../components/card/versions/v5.js';
import { versions as cardVersions } from '../../components/card/motion.js';

const tokens = compileTokens(tokensJson as unknown as DtcgGroup);
const { raw } = tokens;
const css = buildVersionCss(v5, raw, { component: 'card' });

describe('trigger-aware CSS', () => {
  it('wires hover inside (hover: hover), press as :active, and the layer as a descendant rule', () => {
    expect(css).toMatch(/@media \(hover: hover\) \{[\s\S]*\.motion-card-v5:hover \{[\s\S]*translateY/);
    expect(css).toContain('.motion-card-v5:hover [data-motion="image"] {');
    expect(css).toContain('.motion-card-v5:active {');
    // hover is only inside the media query
    const outside = css.replace(/@media \(hover: hover\) \{[\s\S]*?\n\}\n/, '');
    expect(outside).not.toMatch(/\.motion-card-v5:hover \{/);
  });
  it('gives the layer its own timing and the rest rule the way back', () => {
    expect(css).toMatch(/\.motion-card-v5 \[data-motion="image"\] \{[\s\S]*?transition-duration: var\(--motion-duration-140/);
    expect(css).toMatch(/\.motion-card-v5:hover \[data-motion="image"\] \{[\s\S]*?transition-duration: var\(--motion-duration-300/);
  });
  it('lists every trigger selector in the reduced-motion block', () => {
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion'));
    expect(reduced).toContain('.motion-card-v5:hover');
    expect(reduced).toContain('.motion-card-v5:active [data-motion="image"]');
    expect(reduced).toContain('transition: none;');
  });
  it('a focus trigger uses :focus-visible and :has for the inside', () => {
    const f = { ...v5, interaction: { ...v5.interaction!, triggers: [{ on: 'focus' as const, state: 'hover' }, { on: 'hover' as const, state: 'hover', target: 'image' }] } };
    const out = buildVersionCss(f, raw, { component: 'card' });
    expect(out).toContain('.motion-card-v5:focus-visible');
    expect(out).toContain('.motion-card-v5:has(:focus-visible)');
    expect(out).toContain('.motion-card-v5:has([data-motion="image"]:hover)');
  });
  it('a click-only version has no pseudo-class rules', () => {
    const c = buildVersionCss(v4, raw, { component: 'side-panel' });
    expect(c).not.toContain(':hover');
    expect(c).toContain('data-state="open"');
  });
});

describe('GSAP and Motion exports with layers and triggers', () => {
  it('both name each part, and attach the triggers', () => {
    for (const code of [buildGsapCode(v5, raw, { component: 'card' }), buildMotionCode(v5, raw, { component: 'card' })]) {
      expect(code).toContain('layer: "image"');
      expect(code).toContain('export function attachCardV5(el)');
      expect(code).toContain('"on":"hover"');
      expect(code).toContain('return () => off.forEach');
    }
  });
  it('a version with no triggers has no attach', () => {
    const none = { ...v5, interaction: { ...v5.interaction!, triggers: undefined } };
    expect(buildGsapCode(none, raw, { component: 'card' })).not.toContain('export function attach');
  });
  it('the generated attach wires and removes listeners, and hover goes to hover then back', () => {
    const code = buildGsapCode(v5, raw, { component: 'card' });
    const calls: string[] = [];
    const listeners: { node: unknown; type: string; fn: (e: unknown) => void }[] = [];
    const mkNode = () => ({
      dataset: {} as Record<string, string>,
      addEventListener(type: string, fn: (e: unknown) => void) { listeners.push({ node: this, type, fn }); },
      removeEventListener(type: string, fn: (e: unknown) => void) { const k = listeners.findIndex(l => l.node === this && l.type === type && l.fn === fn); if (k >= 0) listeners.splice(k, 1); },
      querySelectorAll: () => [] as unknown[],
    });
    const gsap = { registerPlugin() {}, set: () => undefined, to: (_n: unknown, v: { duration: number }) => { calls.push(String(v.duration)); return {}; } };
    const mod = new Function('gsap', 'CustomEase', 'window', 'document', `${code.replace(/^import .*$/gm, '').replace(/export function/g, 'function').replace(/^CustomEase\.create.*$/gm, '')}\nreturn { attachCardV5, setupCardV5 };`)(
      gsap, { create() {} }, { matchMedia: () => ({ matches: false }) }, { addEventListener() {}, removeEventListener() {} },
    ) as { attachCardV5: (el: object) => () => void; setupCardV5: (el: object) => void };
    const el = mkNode();
    mod.setupCardV5(el);
    const stop = mod.attachCardV5(el);
    const on = (type: string, e: unknown = {}) => listeners.filter(l => l.type === type).forEach(l => l.fn(e));
    on('pointerenter', { pointerType: 'mouse' });
    expect(el.dataset['state']).toBe('hover');
    on('pointerleave');
    expect(el.dataset['state']).toBe('rest');
    on('pointerenter', { pointerType: 'touch' });
    expect(el.dataset['state']).toBe('rest');
    stop();
    expect(listeners.length).toBe(0);
  });
});

describe('spec.md for an interaction version', () => {
  const { markdown: md } = buildVersionExport('card', cardVersions.find(v => v.id === 'v5')!, cardVersions, tokens);
  it('has a Triggers table, the layer states and the layer timing', () => {
    expect(md).toContain('## Triggers');
    expect(md).toMatch(/\| hover \| the component itself \|/);
    expect(md).toContain('layer `image`');
    expect(md).toContain('has its own timing');
  });
  it('the side panel says its open state is set from outside', () => {
    const { markdown: m } = buildVersionExport('side-panel', v4, [v4], tokens);
    expect(m).toContain('Set from outside the component');
  });
});
