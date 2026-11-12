import { describe, it, expect, vi } from 'vitest';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { buildGsapCode, buildMotionCode, buildExportCode, EXPORT_FILES, EXPORT_FORMATS } from '../../lab/lib/export-code.js';
import { buildVersionCss } from '../../lab/lib/css-output.js';
import { motionArgsOf } from '../../lab/lib/motion-args.js';
import { stepsOf } from '../../lab/lib/motion-models.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, MotionVersion } from '../../lab/lib/types.js';
import { versions as cardVersions } from '../../components/card/motion.js';
import { versions as panelVersions } from '../../components/side-panel/motion.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);
gsap.registerPlugin(CustomEase);

const tween = (over: Partial<MotionVersion> = {}): MotionVersion => ({
  id: 'v1',
  label: 'Test',
  model: { model: 'tween', duration: 'duration.250', easing: 'easing.productive-standard' },
  keyframes: [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0px)' }],
  ...over,
});

describe('formats', () => {
  it('has CSS, GSAP and Motion, each with its own file', () => {
    expect(EXPORT_FORMATS).toEqual(['css', 'gsap', 'motion']);
    expect(EXPORT_FILES).toEqual({ css: 'motion.css', gsap: 'motion.gsap.js', motion: 'motion.motion.js' });
  });

  it('buildExportCode returns the CSS as given, and GSAP or Motion code otherwise', () => {
    const v = tween();
    expect(buildExportCode('css', v, raw, { css: 'CSS', component: 'card' })).toBe('CSS');
    expect(buildExportCode('gsap', v, raw, { css: 'CSS', component: 'card' })).toContain('gsap.registerPlugin(CustomEase);');
    expect(buildExportCode('motion', v, raw, { css: 'CSS', component: 'card' })).toContain('import { animate } from "motion"');
  });
});

describe('buildGsapCode', () => {
  it('writes seconds, a CustomEase for the easing token, and plain top-level code', () => {
    const code = buildGsapCode(tween(), raw, { component: 'side-panel' });
    expect(code).toContain('gsap.registerPlugin(CustomEase);');
    expect(code).toContain('CustomEase.create("productive-standard", "0.2,0,0.38,0.9");');
    expect(code).toContain('const el = document.querySelector(".side-panel");');
    expect(code).toContain('tl.from(el, { opacity: 0, y: 16, duration: 0.25, ease: "productive-standard" }, 0);');
    expect(code).toContain('GSAP has no springs, so this is easing only.');
    expect(code).not.toContain('export function');
  });

  it('converts transform functions to GSAP properties', () => {
    const v = tween({
      keyframes: [
        { transform: 'translateX(100%) scale(0.9) rotate(-5deg)' },
        { transform: 'translate(0px, 4px) scaleX(1) scale(1, 0.5)' },
      ],
    });
    const code = buildGsapCode(v, raw, { component: 'c' });
    expect(code).toContain('{ xPercent: 100, scale: 0.9, rotation: -5 }');
    expect(code).toContain('{ x: 0, y: 4, scaleX: 1, scaleX: 1, scaleY: 0.5, duration: 0.25');
  });

  it('lists a transform it cannot convert, instead of dropping it silently', () => {
    const v = tween({ keyframes: [{ transform: 'skewX(10deg)' }, { transform: 'none' }] });
    expect(buildGsapCode(v, raw, { component: 'c' })).toContain('// Not converted (GSAP wants x, y, scale, rotation): skewX(10deg)');
  });

  it("puts a step's delay at its position on the timeline, and says what the page stagger is", () => {
    const v = tween({ stagger: 'delay.80', model: { model: 'tween', duration: 'duration.250', easing: 'easing.productive-standard', delay: 'delay.40' } });
    const code = buildGsapCode(v, raw, { component: 'c' });
    expect(code).toContain('}, 0.04);');
    expect(code).toContain('each section starts 0.08s after the one before (delay.80)');
  });

  it('plays more than two frames as GSAP keyframes with easeEach', () => {
    const v = tween({ keyframes: [{ opacity: 0, offset: 0 }, { opacity: 0.6, offset: 0.4 }, { opacity: 1, offset: 1 }] });
    expect(buildGsapCode(v, raw, { component: 'c' }))
      .toContain('tl.to(el, { keyframes: { "0%": { opacity: 0 }, "40%": { opacity: 0.6 }, "100%": { opacity: 1 }, easeEach: "productive-standard" }, duration: 0.25 }, 0);');
  });

  it('maps CSS keywords to GSAP eases and registers hard-coded curves', () => {
    const keyword = buildGsapCode(tween({ model: { model: 'tween', duration: '300ms', easing: 'ease-out' } }), raw, { component: 'c' });
    expect(keyword).toContain('ease: "power1.out"');
    expect(keyword).not.toContain('CustomEase.create');
    const curve = buildGsapCode(tween({ model: { model: 'tween', duration: '300ms', easing: 'cubic-bezier(0.1, 0.2, 0.3, 0.4)' } }), raw, { component: 'c' });
    expect(curve).toContain('CustomEase.create("custom-1", "0.1,0.2,0.3,0.4");');
  });

  it('plays a spring version as its easing, and says GSAP has no springs', () => {
    const code = buildGsapCode(panelVersions.find(v => v.id === 'v1')!, raw, { component: 'side-panel' });
    expect(code).toContain('GSAP has no springs, so this is easing only.');
    expect(code).toContain('tl.from(el, { opacity: 0, x: 48, duration: 0.7, ease: "expressive-entrance" }, 0);');
    expect(code).not.toContain('bounce');
  });

  it('writes the reduced-motion branch: an opacity fade, or nothing for "none"', () => {
    expect(buildGsapCode(tween(), raw, { component: 'c' })).toContain('tl.from(el, { opacity: 0, duration: 0.15, ease: "productive-standard" }, 0);');
    expect(buildGsapCode(tween({ reducedMotion: 'none' }), raw, { component: 'c' })).not.toContain('prefers-reduced-motion: reduce');
  });

  it('says when it plays, as the CSS does', () => {
    expect(buildGsapCode(tween({ trigger: { on: 'click' } }), raw, { component: 'c' })).toContain('// Plays: On click');
    expect(buildGsapCode(tween(), raw, { component: 'c' })).toContain('trigger not specified');
  });
});

describe('buildMotionCode', () => {
  it('plays every motion as a spring, with the same arguments the lab plays under Motion', () => {
    // (interaction versions are states, not an entrance: tests/unit/interaction.test.ts covers them)
    for (const v of [...cardVersions, ...panelVersions].filter(x => !x.interaction)) {
      const code = buildMotionCode(v, raw, { component: 'c', globalBounce: 'bounce.50' });
      for (const { version: step } of stepsOf(v)) {
        const a = motionArgsOf(step, raw, { globalBounce: 'bounce.50' });
        expect(code, v.id).toContain(`animate(`);
        expect(code, v.id).toContain(JSON.stringify(a.keyframes));
        expect(code, v.id).toContain(`visualDuration: ${a.options.visualDuration}, bounce: ${a.options.bounce}`);
      }
      expect(code, v.id).not.toContain('ease');
    }
  });

  it('uses the version\'s own bounce token, else the global bounce, and says which', () => {
    const code = buildMotionCode(panelVersions.find(v => v.id === 'v1')!, raw, { component: 'side-panel', globalBounce: 'bounce.0' });
    expect(code).toContain('// bounce.50\n');
    expect(code).toContain('bounce: 0.5');
    expect(code).toContain('bounce: 0');
    expect(code).toContain('global bounce setting (bounce.0)');
  });

  it('lists no easing token: nothing plays an easing under Motion', () => {
    expect(buildMotionCode(tween(), raw, { component: 'c' })).toContain('// Tokens: duration.250');
    expect(buildMotionCode(tween(), raw, { component: 'c' })).not.toContain('easing.');
  });

  it('adds the stagger to each delay', () => {
    const code = buildMotionCode(tween({ stagger: 'delay.80' }), raw, { component: 'c' });
    expect(code).toContain('const stagger = 0.08; // delay.80');
    expect(code).toContain('delay: index * stagger');
  });

  it('writes a reduced-motion branch: an opacity fade with no bounce, or nothing for "none"', () => {
    expect(buildMotionCode(tween(), raw, { component: 'c' })).toContain('{"opacity":[0,1]}, { type: "spring", visualDuration: 0.15, bounce: 0, delay: 0 }');
    expect(buildMotionCode(tween({ reducedMotion: 'none' }), raw, { component: 'c' })).toContain('reduced motion: no animation');
  });
});

// The GSAP code, run for real: its timeline must match the CSS export's timing (duration and delay
// of the root and of each layer, and the stagger).
describe('the GSAP code runs in GSAP and matches the CSS timing', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  const cssTimings = (css: string): { duration: number; delay: number; stagger: number }[] => {
    const blocks = [...css.matchAll(/^\.motion-[\w-]+ \{\n([\s\S]*?)\n\}/gm)].map(m => m[1]!);
    return blocks.map(b => {
      const duration = parseFloat(/animation-duration: (?:var\([^,]+, )?(\d+(?:\.\d+)?)ms/.exec(b)![1]!);
      const d = /animation-delay: (.+);/.exec(b)?.[1] ?? '';
      // A delay or stagger is a token variable with its literal as the fallback: var(--motion-delay-70, 70ms).
      const ms = (s: string | undefined): number => parseFloat(/(\d+(?:\.\d+)?)ms/.exec(s ?? '')?.[1] ?? '0');
      const calc = /^calc\((?:(.+?) \+ )?var\(--motion-index, 0\) \* (.+)\)$/.exec(d);
      const delay = calc ? ms(calc[1]) : ms(d);
      const stagger = calc ? ms(calc[2]) : 0;
      return { duration, delay, stagger };
    });
  };

  const run = (v: MotionVersion, component: string, reduced = false) => {
    const code = buildGsapCode(v, raw, { component });
    const timelines: gsap.core.Timeline[] = [];
    const layers: Record<string, object> = {};
    const el = { querySelectorAll: (sel: string) => [(layers[sel] ??= {})], addEventListener: () => undefined, dataset: {} };
    const wrapped = {
      ...gsap,
      registerPlugin: () => undefined,
      timeline: (vars: Record<string, unknown> = {}) => {
        const { scrollTrigger: _s, ...rest } = vars;
        const tl = gsap.timeline(rest);
        tl.pause();
        timelines.push(tl);
        return tl;
      },
      matchMedia: () => ({ add: (q: string, fn: () => void) => { if (q.endsWith(reduced ? ': reduce)' : ': no-preference)')) fn(); } }),
    };
    new Function('gsap', 'CustomEase', 'ScrollTrigger', 'document', 'window', code)(
      wrapped, CustomEase, {}, { querySelector: () => el, addEventListener: () => undefined }, { matchMedia: () => ({ matches: reduced }) },
    );
    return timelines;
  };

  for (const [component, versions] of [['card', cardVersions], ['side-panel', panelVersions]] as const) {
    for (const v of versions.filter(x => !x.interaction)) {
      it(`${component} ${v.id}: the root and each layer start and last as the CSS says`, () => {
        const expected = cssTimings(buildVersionCss(v, raw, { component }));
        const [tl] = run(v, component);
        const children = tl!.getChildren(false, true, false);
        expect(children.length, `${component} ${v.id}`).toBe(expected.length);
        children.forEach((child, i) => {
          const e = expected[i]!;
          expect(child.duration() * 1000, `${v.id} step ${i} duration`).toBeCloseTo(e.duration, 3);
          expect((tl!.delay() + child.startTime()) * 1000, `${v.id} step ${i} start`).toBeCloseTo(e.delay, 3);
        });
      });
    }
  }

  it('under reduced motion it plays only a short fade, or nothing for "none"', () => {
    const [fade] = run(cardVersions.find(v => v.id === 'v1')!, 'card', true);
    for (const child of fade!.getChildren(false, true, false)) expect(child.duration()).toBeLessThanOrEqual(0.15);
    expect(run({ ...cardVersions[0]!, reducedMotion: 'none' }, 'card', true)).toHaveLength(0);
  });
});
