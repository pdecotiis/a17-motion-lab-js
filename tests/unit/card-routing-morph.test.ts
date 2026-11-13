import { describe, it, expect } from 'vitest';
import { validateMotionVersion } from '../../lab/lib/motion-models.js';
import { validateVersionMeta } from '../../lab/lib/version-meta.js';
import { versions, v1 } from '../../components/card-routing-morph/motion.js';

// the three arrangements of the bento, each a panel; a slide opens one panel, the one that is next waits below the stage and the one that was there has closed at the top
describe('card-routing-morph v1', () => {
  it('validates and has lineage', () => {
    expect(() => validateMotionVersion(v1)).not.toThrow();
    expect(() => validateVersionMeta(versions)).not.toThrow();
  });

  const all = Object.keys(v1.interaction!.states);
  const states = all.filter(s => s !== 'slide-0');   // slide-0 is the start: it looks like slide-1
  const panel = (n: number, state: string) => (v1.interaction!.layers![`panel-${n}`]!.states as Record<string, Record<string, string>>)[state]!;

  it('has three slides, machine learning first, after a start that looks like it', () => {
    expect(states).toEqual(['slide-1', 'slide-2', 'slide-3']);
    expect(v1.interaction!.initial).toBe('slide-0');
    expect(panel(1, 'slide-0')).toEqual(panel(1, 'slide-1'));
  });

  it('opens exactly one panel in every slide', () => {
    for (const s of states) {
      const open = [1, 2, 3].filter(n => panel(n, s)['height'] === 'calc(100cqh + 0px)');
      expect(open).toHaveLength(1);
    }
  });

  it('always opens the next slide from below the stage, including after the last one', () => {
    // the panel of a slide waits below (a 108px margin-top, no height) in the slide before it: machine learning waits below in the slide of technology
    const slides = [1, 2, 3];
    for (const n of slides) {
      const before = states[(n - 2 + 3) % 3]!;
      expect(panel(n, before)['marginTop']).toBe('calc(100cqh + 8px)');
      expect(panel(n, before)['height']).toBe('calc(0cqh + 0px)');
    }
  });

  it('closes a panel at the top: after its slide it is closed with no margin', () => {
    for (const n of [1, 2, 3]) {
      const after = states[n % 3]!;
      expect(panel(n, after)['marginTop']).toBe('calc(0cqh + 0px)');
      expect(panel(n, after)['height']).toBe('calc(0cqh + 0px)');
    }
  });
});
