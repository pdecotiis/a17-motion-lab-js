import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerTrigger, clearTriggers, getTrigger, type ProjectTrigger } from '../../lab/lib/project-triggers.js';
import { validateInteraction } from '../../lab/lib/interaction.js';
import { summarizeInteraction } from '../../lab/lib/interaction-summary.js';
import { buildGsapCode, buildMotionCode } from '../../lab/lib/export-code.js';
import { buildVersionExport } from '../../lab/lib/spec.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, MotionVersion } from '../../lab/lib/types.js';

// The mechanism for a project's own triggers (a file in /triggers/): a stand-in trigger, so no real project trigger ships with the template.
const tokens = compileTokens(tokensJson as unknown as DtcgGroup);
const { raw } = tokens;
const T = { model: 'tween' as const, duration: 'duration.200', easing: 'easing.productive-standard' };

const tick: ProjectTrigger = {
  name: 'tick',
  validate(s, { id, states }) {
    const t = s as unknown as { every?: unknown; toggle?: string[] };
    if (typeof t.every !== 'string') throw new Error(`${id} tick trigger needs "every"`);
    for (const x of t.toggle ?? []) if (!states.includes(x)) throw new Error(`${id} tick trigger steps through "${x}", which is not one of its states`);
  },
  attach: () => () => {},
  describe: s => ({ heading: 'Tick', summary: `Every ${String(s['every'])} it steps to the next state.`, led: ['b', 'c'], event: 'tick', on: 'a timer', means: `every ${String(s['every'])}`, what: 'steps to the next state' }),
  exportSettings: (s, r) => ({ ...s, every: parseFloat(String(r[String(s['every'])] ?? s['every'])) }),
  exportCode: () => [
    'let timer;',
    'const rearm = () => { clearTimeout(timer); timer = setTimeout(() => { base = t.toggle[(t.toggle.indexOf(base) + 1) % t.toggle.length]; settle(); }, t.every); };',
    'afterMove.push(rearm);',
    'off.push(() => clearTimeout(timer));',
    'rearm();',
  ],
};
const version = (triggers: unknown[]): MotionVersion => ({
  id: 'v1', label: 'x', lineage: 'test',
  interaction: { initial: 'a', states: { a: { opacity: 1 }, b: { opacity: 0.5 }, c: { opacity: 0.25 } }, transitions: { a: T, b: T, c: T }, triggers: triggers as never },
});
const ticking = version([{ on: 'tick', every: '500ms', toggle: ['a', 'b', 'c'] }]);

describe('project triggers', () => {
  beforeEach(() => { clearTriggers(); registerTrigger(tick); });
  afterEach(() => clearTriggers());

  it('a name must be lowercase and not one of the lab\'s own', () => {
    expect(() => registerTrigger({ ...tick, name: 'hover' })).toThrow('one of the lab\'s own triggers');
    expect(() => registerTrigger({ ...tick, name: 'Tick Tock' })).toThrow('lowercase letters');
    expect(getTrigger('tick')).toBe(tick);
  });

  it('a version may use one by name, and its own validation runs', () => {
    expect(() => validateInteraction(ticking)).not.toThrow();
    expect(() => validateInteraction(version([{ on: 'tick', toggle: ['a', 'b'] }]))).toThrow('needs "every"');
    expect(() => validateInteraction(version([{ on: 'tick', every: '500ms', toggle: ['a', 'lost'] }]))).toThrow('"lost", which is not one of its states');
  });

  it('a name with no file says where it should be', () => {
    clearTriggers();
    expect(() => validateInteraction(ticking)).toThrow('unknown trigger "tick"');
    expect(() => validateInteraction(ticking)).toThrow('triggers/tick.ts');
  });

  it('"What it does" and spec.md say what it does, from its own description', () => {
    expect(summarizeInteraction(ticking, raw, 'css').text).toContain('Every 500ms it steps to the next state.');
    const { markdown } = buildVersionExport('thing', ticking, [ticking], tokens);
    expect(markdown).toContain('| tick | a timer | every 500ms | steps to the next state |');
  });

  it('the GSAP and Motion code carry its settings and its code, and a trigger without export code says to wire it by hand', () => {
    for (const code of [buildGsapCode(ticking, raw, { component: 'thing' }), buildMotionCode(ticking, raw, { component: 'thing' })]) {
      expect(code).toContain('"on":"tick"');
      expect(code).toContain('"every":500');                         // the settings as exportSettings wrote them
      expect(code).toContain('if (t.on === "tick") {');
      expect(code).toContain('afterMove.push(rearm);');
    }
    registerTrigger({ ...tick, exportCode: undefined });
    expect(buildGsapCode(ticking, raw, { component: 'thing' })).toContain('"tick" is a project trigger with no export code');
  });

  describe('the exported attach', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });
    it('steps by itself, restarts on a move, and stops when removed', () => {
      const code = buildGsapCode(ticking, raw, { component: 'thing' });
      const gsap = { registerPlugin() {}, set: () => undefined, to: () => ({}) };
      const mod = new Function('gsap', 'CustomEase', 'window', 'document', `${code.replace(/^import .*$/gm, '').replace(/export function/g, 'function').replace(/^CustomEase\.create.*$/gm, '')}\nreturn { attachThingV1, setupThingV1 };`)(
        gsap, { create() {} }, { matchMedia: () => ({ matches: false }) }, { addEventListener() {}, removeEventListener() {} },
      ) as { attachThingV1: (el: object) => () => void; setupThingV1: (el: object) => void };
      const el = { dataset: {} as Record<string, string>, addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [] as unknown[] };
      mod.setupThingV1(el);
      const stop = mod.attachThingV1(el);
      vi.advanceTimersByTime(499);
      expect(el.dataset['state']).toBe('a');
      vi.advanceTimersByTime(2);
      expect(el.dataset['state']).toBe('b');
      vi.advanceTimersByTime(500);
      expect(el.dataset['state']).toBe('c');
      vi.advanceTimersByTime(500);
      expect(el.dataset['state']).toBe('a');                           // round to the first
      stop();
      vi.advanceTimersByTime(5000);
      expect(el.dataset['state']).toBe('a');                           // removed: nothing steps any more
    });
  });
});
