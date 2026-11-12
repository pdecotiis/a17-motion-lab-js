import { describe, it, expect } from 'vitest';
import interval from '../../triggers/interval';
import { getTrigger } from '../../lab/lib/project-triggers.js';
import { validateInteraction } from '../../lab/lib/interaction.js';
import { buildGsapCode } from '../../lab/lib/export-code.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
import { versions } from '../../components/card-routing-shuffle/motion.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);
const v1 = versions[0]!;

describe('the interval project trigger (triggers/interval.ts)', () => {
  it('is found by the lab and the shuffle bento uses it', () => {
    expect(getTrigger('interval')).toBe(interval);
    expect(v1.interaction!.triggers!.some(t => t.on === 'interval')).toBe(true);
    expect(() => validateInteraction(v1)).not.toThrow();
  });
  it('refuses a missing time and a short or unknown list', () => {
    const v = (t: unknown) => ({ ...v1, interaction: { ...v1.interaction!, triggers: [t as never] } });
    expect(() => validateInteraction(v({ on: 'interval', toggle: ['default', 'layout-2'] }))).toThrow('needs "every"');
    expect(() => validateInteraction(v({ on: 'interval', every: '5000ms', toggle: ['default'] }))).toThrow('two or more different states');
    expect(() => validateInteraction(v({ on: 'interval', every: '5000ms', toggle: ['default', 'lost'] }))).toThrow('"lost", which is not one of its states');
  });
  it('reads a time or a token', () => {
    expect(interval.exportSettings!({ on: 'interval', every: '5000ms', toggle: [] }, raw)['every']).toBe(5000);
    expect(interval.exportSettings!({ on: 'interval', every: 'duration.400', toggle: [] }, raw)['every']).toBe(400);
  });
  it('the GSAP code carries the timer', () => {
    const code = buildGsapCode(v1, raw, { component: 'card-routing-shuffle' });
    expect(code).toContain('"every":5000');
    expect(code).toContain('afterShow.push(rearm);');
  });
});
