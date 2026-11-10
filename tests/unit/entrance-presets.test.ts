import { describe, it, expect, afterAll } from 'vitest';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { SAMPLES_PRESENT, TEMPLATE_PRESETS } from '../samples.js';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PRESETS, PRESET_NAMES, SEPARATE_FADE, hasFadeTrack, presetTracks, type EntrancePreset } from '../../lab/lib/entrance-presets.js';
import { hasEntrance, isPresetStep, stepsOf, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { getStepRefs, pairingWarnings, type StepRefs } from '../../lab/lib/token-refs.js';
import { buildPresetsCss, buildVersionCss, presetsUsed } from '../../lab/lib/css-output.js';
import { buildGsapCode, buildMotionCode, buildPresetsGsap, buildPresetsMotion, PRESET_FILES } from '../../lab/lib/export-code.js';
import { buildVersionExport } from '../../lab/lib/spec.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, MotionVersion } from '../../lab/lib/types.js';

const tokens = compileTokens(tokensJson as unknown as DtcgGroup);
const { raw } = tokens;
gsap.registerPlugin(CustomEase);

// An inline fixture: a card that uses presets, its title lines staggered and its text a beat later.
const demo: MotionVersion = {
  id: 'v1',
  label: 'Preset demo',
  entrance: { preset: 'card' },
  layers: {
    title: { preset: 'title', delay: 'delay.80', stagger: 'delay.40' },
    text: { preset: 'text', delay: 'delay.120' },
  },
  lineage: 'test',
};

describe.skipIf(!TEMPLATE_PRESETS)('the presets table', () => {
  it('has the six presets, in order', () => {
    expect(PRESET_NAMES).toEqual(['eyebrow', 'title', 'text', 'card', 'media', 'ui']);
  });

  it('matches the spec: values per preset', () => {
    const fade = { duration: 'duration.250', easing: 'easing.productive-entrance' };
    const move = { duration: 'duration.700', easing: 'easing.expressive-entrance' };
    for (const name of ['eyebrow', 'title', 'text'] as const) {
      expect(PRESETS[name], name).toEqual({ rise: 'distance.20', move, fade, status: 'experimental' });
    }
    expect(PRESETS.card).toMatchObject({ rise: 'distance.20', scale: 'scale.95', move, fade, status: 'experimental' }); // plus its hover and press: element-presets.test.ts
    expect(PRESETS.media).toEqual({ rise: 'distance.20', scale: 'scale.95', move, fade, status: 'experimental' });
    expect(PRESETS.ui).toMatchObject({
      rise: 'distance.8',
      move: { duration: 'duration.150', easing: 'easing.productive-standard' },
      fade: { duration: 'duration.100', easing: 'easing.productive-entrance' },
      status: 'experimental',
    });
  });

  it('only references tokens that exist (no new token type)', () => {
    for (const name of PRESET_NAMES) {
      const p = PRESETS[name]!;
      const refs = [p.rise, p.scale, p.move.duration, p.move.easing, p.fade?.duration, p.fade?.easing].filter(Boolean) as string[];
      for (const r of refs) expect(r in raw, `${name}: ${r}`).toBe(true);
    }
  });

  it('resolves to the values in the spec (20/8 px, 0.95, 250/700/100/150 ms)', () => {
    expect(raw['distance.20']).toBe('20px');
    expect(raw['distance.8']).toBe('8px');
    expect(raw['scale.95']).toBe(0.95);
    for (const [t, ms] of [['duration.250', '250ms'], ['duration.700', '700ms'], ['duration.100', '100ms'], ['duration.150', '150ms']] as [string, string][]) expect(raw[t]).toBe(ms);
  });

  it('every track of every preset follows the pairing rules', () => {
    for (const name of PRESET_NAMES) {
      const v: MotionVersion = { id: 'v1', label: name, entrance: { preset: name }, lineage: 'test' };
      expect(pairingWarnings(v, raw), name).toEqual([]);
    }
  });
});

describe.skipIf(!TEMPLATE_PRESETS)('presetTracks', () => {
  it('two tracks: a fade (a spring with no bounce) and a move (a tween with the transform)', () => {
    expect(SEPARATE_FADE).toBe(true);
    const [fade, move] = presetTracks('title');
    expect(fade!.track).toBe('fade');
    expect(fade!.model).toMatchObject({ model: 'spring', duration: 'duration.250', easing: 'easing.productive-entrance', bounce: 'bounce.0', properties: [{ property: 'opacity', from: 0, to: 1 }] });
    expect(move!.track).toBe('move');
    expect(move!.model).toMatchObject({ model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance' });
    expect(move!.keyframes).toEqual([
      { transform: 'translateY({distance.20})', offset: 0 },
      { transform: 'translateY(0px)', offset: 1 },
    ]);
  });

  it('card and media scale up from their scale token as part of the move', () => {
    expect(presetTracks('card')[1]!.keyframes).toEqual([
      { transform: 'translateY({distance.20}) scale({scale.95})', offset: 0 },
      { transform: 'translateY(0px) scale(1)', offset: 1 },
    ]);
    expect(presetTracks('media')[1]!.keyframes![0]!['transform']).toBe('translateY({distance.20}) scale({scale.95})');
  });

  it('a delay goes on every track', () => {
    for (const t of presetTracks('text', 'delay.80')) expect(t.model.delay).toBe('delay.80');
  });

  it('one track ("all") when a preset has no fade timing: opacity and transform together, the move\'s timing', () => {
    // SEPARATE_FADE = false does the same for every preset; a preset without `fade` does it for that one.
    const synthetic: EntrancePreset = { rise: 'distance.8', move: PRESETS['ui']!.move };
    expect(hasFadeTrack(synthetic)).toBe(false);
    expect(hasFadeTrack(PRESETS['title']!)).toBe(true);
    // The track builder reads the table, so check the one-track shape on a table entry with its fade removed.
    const saved = PRESETS['eyebrow']!;
    (PRESETS as Record<string, EntrancePreset>)['eyebrow'] = { rise: saved.rise, move: saved.move };
    try {
      const tracks = presetTracks('eyebrow');
      expect(tracks).toHaveLength(1);
      expect(tracks[0]!.track).toBe('all');
      expect(tracks[0]!.model).toMatchObject({ model: 'tween', duration: 'duration.700', easing: 'easing.expressive-entrance' });
      expect(tracks[0]!.keyframes).toEqual([
        { opacity: 0, transform: 'translateY({distance.20})', offset: 0 },
        { opacity: 1, transform: 'translateY(0px)', offset: 1 },
      ]);
    } finally {
      (PRESETS as Record<string, EntrancePreset>)['eyebrow'] = saved;
    }
  });
});

describe.skipIf(!TEMPLATE_PRESETS)('a preset in a version', () => {
  it('hasEntrance is true for an entrance preset, and isPresetStep tells the layers apart', () => {
    expect(hasEntrance(demo)).toBe(true);
    expect(isPresetStep(demo.layers!['title']!)).toBe(true);
    expect(isPresetStep({ model: { model: 'tween', duration: 'duration.250', easing: 'easing.productive-entrance' }, keyframes: [] })).toBe(false);
  });

  it('validates', () => {
    expect(() => validateMotionVersion(demo)).not.toThrow();
  });

  it('stepsOf: two entries per element (fade, move), the root first, then each layer', () => {
    const steps = stepsOf(demo);
    expect(steps.map(s => `${s.name ?? 'root'}:${s.track}`)).toEqual([
      'root:fade', 'root:move', 'title:fade', 'title:move', 'text:fade', 'text:move',
    ]);
    expect(steps.every(s => s.preset)).toBe(true);
    expect(steps[0]!.version.model.model).toBe('spring');
    expect(steps[1]!.version.model.model).toBe('tween');
  });

  it('the layer\'s delay is on its tracks, and its stagger is carried on the entry as elementStagger', () => {
    const title = stepsOf(demo).filter(s => s.name === 'title');
    expect(title.every(s => s.version.model.delay === 'delay.80')).toBe(true);
    expect(title.every(s => s.elementStagger === 'delay.40')).toBe(true);
    expect(stepsOf(demo).filter(s => s.name === 'text').every(s => s.elementStagger === undefined)).toBe(true);
  });

  it('mixes with a layer that has its own model and keyframes', () => {
    const mixed: MotionVersion = {
      ...demo,
      layers: { ...demo.layers, badge: { model: { model: 'tween', duration: 'duration.200', easing: 'easing.productive-entrance' }, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }] } },
    };
    expect(() => validateMotionVersion(mixed)).not.toThrow();
    const badge = stepsOf(mixed).filter(s => s.name === 'badge');
    expect(badge).toHaveLength(1);
    expect(badge[0]!.preset).toBeUndefined();
  });

  it('refuses an unknown preset, an entrance together with a model, extra keys and a non-string delay', () => {
    expect(() => validateMotionVersion({ ...demo, entrance: { preset: 'banner' as never } })).toThrow('unknown preset "banner"');
    expect(() => validateMotionVersion({ ...demo, model: { model: 'tween', duration: 'duration.250', easing: 'easing.productive-entrance' } })).toThrow('an entrance preset and a model');
    expect(() => validateMotionVersion({ ...demo, entrance: { preset: 'card', duration: 'duration.250' } as never })).toThrow('takes only preset, delay and stagger');
    expect(() => validateMotionVersion({ ...demo, layers: { title: { preset: 'title', delay: 70 as never } } })).toThrow('delay must be');
    expect(() => validateMotionVersion({ ...demo, layers: { title: { preset: 'nope' as never } } })).toThrow('layer "title" names an unknown preset');
  });
});

describe.skipIf(!TEMPLATE_PRESETS)('tokens used and pairing for a preset version', () => {
  it('each track is a group, named "<element> fade" and "<element> move" (the root is "root")', () => {
    const labels = getStepRefs(demo, raw).map(s => s.layer);
    expect(labels).toEqual(['root fade', 'root move', 'title fade', 'title move', 'text fade', 'text move']);
  });

  it('lists the preset\'s tokens (duration, easing, distance, scale, delay) with where they sit', () => {
    const groups: Record<string, StepRefs> = Object.fromEntries(getStepRefs(demo, raw).map(s => [String(s.layer), s]));
    const tokensOf = (label: string) => groups[label]!.uses.map(u => u.token);
    expect(tokensOf('root move')).toEqual(expect.arrayContaining(['duration.700', 'easing.expressive-entrance', 'distance.20', 'scale.95']));
    expect(tokensOf('title fade')).toEqual(expect.arrayContaining(['duration.250', 'easing.productive-entrance', 'delay.80']));
  });

  it('under Motion no easing is listed, and the fade lists bounce.0', () => {
    const groups: Record<string, StepRefs> = Object.fromEntries(getStepRefs(demo, raw, 'motion', 'bounce.25').map(s => [String(s.layer), s]));
    expect(groups['title move']!.uses.map(u => u.token)).not.toContain('easing.expressive-entrance');
    expect(groups['title fade']!.uses.map(u => u.token)).toContain('bounce.0');
    expect(groups['title move']!.uses.map(u => u.token)).toContain('bounce.25');
  });
});

describe.skipIf(!TEMPLATE_PRESETS)('presets.css and the component CSS', () => {
  const css = buildPresetsCss(raw);

  it('one @keyframes per track and a .motion-preset-<name> class that runs them together', () => {
    expect(css).toContain('@keyframes motion-preset-title-fade');
    expect(css).toContain('@keyframes motion-preset-title-move');
    expect(css).toMatch(/\.motion-preset-title \{[\s\S]*?animation-name: motion-preset-title-fade, motion-preset-title-move;/);
    expect(css).toContain('animation-duration: var(--motion-duration-250, 250ms), var(--motion-duration-700, 700ms);');
    expect(css).toContain('translateY(var(--motion-distance-20, 20px))');
    expect(css).toContain('scale(var(--motion-scale-95, 0.95))');
    for (const name of PRESET_NAMES) expect(css, name).toContain(`.motion-preset-${name} {`);
  });

  it('the delay and stagger come from custom properties the component sets', () => {
    expect(css).toContain('animation-delay: calc(var(--motion-delay, 0ms) + var(--motion-item, 0) * var(--motion-stagger, 0ms));');
  });

  it('reduced motion: only the opacity fade, 150ms at most', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/\.motion-preset-title \{\s*animation-name: motion-preset-title-fade;\s*animation-duration: 150ms;/);
    expect(css).toMatch(/\.motion-preset-ui \{\s*animation-name: motion-preset-ui-fade;\s*animation-duration: 100ms;/);
  });

  it('can be limited to the presets a version uses; presetsUsed lists them in order', () => {
    expect(presetsUsed(stepsOf(demo))).toEqual(['card', 'title', 'text']);
    const some = buildPresetsCss(raw, ['title']);
    expect(some).toContain('.motion-preset-title {');
    expect(some).not.toContain('.motion-preset-card {');
  });

  it('the component CSS names the preset and sets the delay and stagger, with no keyframes of its own', () => {
    const c = buildVersionCss(demo, raw, { component: 'card' });
    expect(c).not.toContain('@keyframes');
    expect(c).toContain('Add .motion-preset-card to the element');
    expect(c).toMatch(/\.motion-card-v1-title \{[^}]*Set --motion-item[^}]*--motion-stagger: var\(--motion-delay-40, 40ms\);/);
    expect(c).toContain('--motion-delay: var(--motion-delay-80, 80ms);');
    expect(c).toContain('--motion-delay: var(--motion-delay-120, 120ms);');
  });

  it('includePresets puts the shared definitions above the component CSS', () => {
    const c = buildVersionCss(demo, raw, { component: 'card', includePresets: true });
    expect(c.indexOf('@keyframes motion-preset-card-fade')).toBeGreaterThan(-1);
    expect(c.indexOf('@keyframes motion-preset-card-fade')).toBeLessThan(c.indexOf('.motion-card-v1-title'));
    expect(c).not.toContain('@keyframes motion-preset-ui-fade'); // only what it uses
  });

  it('a version with states keeps the entrance from holding its last frame over them', () => {
    const withStates: MotionVersion = { ...demo, interaction: { initial: 'rest', states: { rest: { transform: 'none' }, hover: { transform: 'translateY(-{distance.4})' } }, transitions: { rest: { model: 'tween', duration: 'duration.150', easing: 'easing.productive-exit' }, hover: { model: 'tween', duration: 'duration.200', easing: 'easing.productive-standard' } }, triggers: [{ on: 'hover', state: 'hover' }] } };
    const c = buildVersionCss(withStates, raw, { component: 'card' });
    expect(c).toContain('.motion-preset-card.motion-card-v1 {');
    expect(c).toContain('animation-fill-mode: backwards;');
  });
});

describe.skipIf(!TEMPLATE_PRESETS)('presets.gsap.js and presets.motion.js', () => {
  const gsapShared = buildPresetsGsap(raw);
  const motionShared = buildPresetsMotion(raw, 'bounce.25');

  it('file names per format', () => {
    expect(PRESET_FILES).toEqual({ css: 'presets.css', gsap: 'presets.gsap.js', motion: 'presets.motion.js' });
  });

  it('GSAP: a presets table in seconds and pixels with the easings registered, and playPreset', () => {
    expect(gsapShared).toContain('CustomEase.create("expressive-entrance", "0, 0, 0.3, 1")');
    expect(gsapShared).toContain('CustomEase.create("productive-entrance"');
    expect(gsapShared).toContain('title: { rise: 20, move: { duration: 0.7, ease: "expressive-entrance" }, fade: { duration: 0.25, ease: "productive-entrance" } }');
    expect(gsapShared).toContain('card: { rise: 20, scale: 0.95,');
    expect(gsapShared).toContain('ui: { rise: 8, move: { duration: 0.15, ease: "productive-standard" }, fade: { duration: 0.1, ease: "productive-entrance" } }');
    expect(gsapShared).toContain('export function playPreset(target, name, { delay = 0, stagger = 0 } = {})');
  });

  it('Motion: springs, the fade with no bounce, the move with the global bounce', () => {
    expect(motionShared).toContain('import { animate, stagger as staggerDelay } from "motion"');
    expect(motionShared).toContain('const bounce = 0.25; // bounce.25');
    expect(motionShared).toContain('type: "spring"');
    expect(motionShared).not.toContain('CustomEase');
    expect(motionShared).not.toMatch(/ease:/);
    expect(buildPresetsMotion(raw, 'bounce.50')).toContain('const bounce = 0.5; // bounce.50');
  });

  it('the component code calls playPreset for each element and imports the shared file', () => {
    const g = buildGsapCode(demo, raw, { component: 'card' });
    expect(g).toContain('import { playPreset } from "./presets.gsap.js";');
    expect(g).toContain('tl.add(playPreset(el, "card", { delay: 0 }), 0);');
    expect(g).toContain('playPreset(el.querySelectorAll("[data-motion=\\"title\\"]"), "title", { delay: 0.08, stagger: 0.04 }), 0);');
    expect(g).toContain('"text", { delay: 0.12 }');
    expect(g).not.toContain('CustomEase.create'); // the easings live in the shared file

    const m = buildMotionCode(demo, raw, { component: 'card' });
    expect(m).toContain('import { playPreset } from "./presets.motion.js";');
    expect(m).toContain('controls.push(...playPreset(el, "card", { delay: 0 }));');
    expect(m).toContain('"title", { delay: 0.08, stagger: 0.04 }');
  });

  it('page stagger adds index * stagger under Motion and a timeline delay under GSAP', () => {
    const staggered: MotionVersion = { ...demo, stagger: 'delay.80' };
    expect(buildMotionCode(staggered, raw, { component: 'card' })).toContain('{ delay: 0 + index * stagger }');
    expect(buildGsapCode(staggered, raw, { component: 'card' })).toContain('gsap.timeline({ delay: index * stagger })');
  });

  it('includePresets puts the shared file above, with no duplicate imports', () => {
    for (const [code, shared, importLine] of [
      [buildGsapCode(demo, raw, { component: 'card', includePresets: true }), gsapShared, './presets.gsap.js'],
      [buildMotionCode(demo, raw, { component: 'card', includePresets: true }), motionShared, './presets.motion.js'],
    ] as const) {
      expect(code.startsWith(shared.trimEnd())).toBe(true);
      expect(code).not.toContain(importLine);
      expect(code).toContain('export function playCardV1(el');
      expect(code.match(/^import /gm)!.length).toBe(shared.match(/^import /gm)!.length);
      expect(code.match(/export function playPreset/g)).toHaveLength(1);
    }
  });

  it('a version with no presets is left as it was', () => {
    const plain = buildGsapCode({ id: 'v1', label: 'x', model: { model: 'tween', duration: 'duration.250', easing: 'easing.productive-entrance' }, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }], lineage: 'test' }, raw, { component: 'x', includePresets: true });
    expect(plain).not.toContain('playPreset');
  });

  it('runs: playPreset adds a fade tween and then a move tween with the delay and stagger; reduced motion keeps only the fade', () => {
    const run = (reduced: boolean) => {
      const calls: { from: Record<string, number>; to: Record<string, number>; position: number }[] = [];
      const fakeGsap = {
        registerPlugin() {},
        timeline: () => {
          const tl = { fromTo: (_t: unknown, from: Record<string, number>, to: Record<string, number>, position: number) => { calls.push({ from, to, position }); return tl; } };
          return tl;
        },
      };
      const code = gsapShared.replace(/^import .*$/gm, '').replace(/^CustomEase\.create.*$/gm, '').replace(/^gsap\.registerPlugin.*$/gm, '').replace('export function', 'function');
      const { playPreset } = new Function('gsap', 'CustomEase', 'window', `${code}\nreturn { playPreset };`)(
        fakeGsap, { create() {} }, { matchMedia: () => ({ matches: reduced }) },
      ) as { playPreset: (target: unknown, name: string, o?: { delay?: number; stagger?: number }) => unknown };
      playPreset({}, 'card', { delay: 0.08, stagger: 0.04 });
      return calls;
    };
    const full = run(false);
    expect(full).toHaveLength(2);
    expect(full[0]).toMatchObject({ from: { opacity: 0 }, to: { opacity: 1, duration: 0.25, ease: 'productive-entrance', stagger: 0.04 }, position: 0.08 });
    expect(full[1]).toMatchObject({ from: { y: 20, scale: 0.95 }, to: { y: 0, scale: 1, duration: 0.7, ease: 'expressive-entrance', stagger: 0.04 }, position: 0.08 });
    const reduced = run(true);
    expect(reduced).toHaveLength(1);
    expect(reduced[0]!.to['duration']).toBe(0.15);
    expect(reduced[0]!.from).toEqual({ opacity: 0 });
  });
});

describe.skipIf(!TEMPLATE_PRESETS)('spec.md for a preset version', () => {
  const { markdown, css } = buildVersionExport('card', demo, [demo], tokens);

  it('names the preset for each element, with its fade and move tracks', () => {
    expect(markdown).toContain('The **card** preset');
    expect(markdown).toContain('`presets.css`, `presets.gsap.js`, `presets.motion.js`');
    expect(markdown).toContain('## Layer: title');
    expect(markdown).toContain('The **title** preset');
    expect(markdown).toContain('### Fade');
    expect(markdown).toContain('### Move');
    expect(markdown).toContain('--motion-item');
  });

  it('its CSS is the component part only (no keyframes: those are in presets.css)', () => {
    expect(css).not.toContain('@keyframes');
  });
});

describe.skipIf(!SAMPLES_PRESENT || !TEMPLATE_PRESETS)('npm run spec with presets', () => {
  const root = resolve(import.meta.dirname, '../..');
  const out = mkdtempSync(join(tmpdir(), 'motion-lab-presets-'));
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  // The CLI exports the components in components/ (no shipped version uses a preset), so this checks that a
  // version with no presets gets no preset files; what the CLI writes for one is built by the functions above.
  it('writes no preset files for a version that uses none', () => {
    execFileSync('npx', ['vite-node', 'scripts/export-spec.ts', '--', 'card', 'v1', '--format', 'all', '--out', out], { cwd: root });
    for (const f of Object.values(PRESET_FILES)) expect(existsSync(join(out, 'card', 'v1', f)), f).toBe(false);
  });
});
