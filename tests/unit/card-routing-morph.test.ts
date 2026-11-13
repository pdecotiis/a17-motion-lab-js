import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateMotionVersion } from '../../lab/lib/motion-models.js';
import { validateVersionMeta } from '../../lab/lib/version-meta.js';
import { versions, v1 } from '../../components/card-routing-morph/motion.js';

// the three arrangements of the bento, in two columns: every cell of every arrangement is in its column, and a slide opens the cells of its arrangement and closes the others,
// so the big picture opens (or closes) from between the card and the row, as in the shuffle bento
describe('card-routing-morph v1', () => {
  it('validates and has lineage', () => {
    expect(() => validateMotionVersion(v1)).not.toThrow();
    expect(() => validateVersionMeta(versions)).not.toThrow();
  });

  const all = Object.keys(v1.interaction!.states);
  const states = all.filter(s => s !== 'slide-0');   // slide-0 is the start: it looks like slide-1
  const height = (cell: string, state: string) => (v1.interaction!.layers![cell]!.states as Record<string, Record<string, string>>)[state]!['height']!;
  const OPEN = (h: string) => h !== 'calc(0cqh + 0px)';
  const LEFT = ['m-card', 'e-card', 't-large', 'e-row', 'm-row'], RIGHT = ['t-row', 'm-large', 'e-large', 't-card'];
  const SLIDE_OF: Record<string, number> = { m: 0, t: 1, e: 2 };

  it('has three slides, machine learning first, after a start that looks like it', () => {
    expect(states).toEqual(['slide-1', 'slide-2', 'slide-3']);
    expect(v1.interaction!.initial).toBe('slide-0');
    for (const cell of [...LEFT, ...RIGHT]) expect(height(cell, 'slide-0')).toBe(height(cell, 'slide-1'));
  });

  it('opens only the cells of the slide that is showing, and each column fills the stage', () => {
    states.forEach((s, i) => {
      for (const cell of [...LEFT, ...RIGHT]) expect(OPEN(height(cell, s)), `${cell} in ${s}`).toBe(SLIDE_OF[cell[0]!] === i);
    });
  });

  it('puts the big picture between the card and the row in the left column, and each column\'s cells in the order that makes pictures open from between', () => {
    expect(LEFT.indexOf('t-large')).toBeGreaterThan(LEFT.indexOf('m-card'));
    expect(LEFT.indexOf('t-large')).toBeLessThan(LEFT.indexOf('m-row'));
    expect(RIGHT.indexOf('e-large')).toBeGreaterThan(RIGHT.indexOf('t-row'));
    expect(RIGHT.indexOf('e-large')).toBeLessThan(RIGHT.indexOf('t-card'));
  });

  it('has every cell in the markup, in those orders', () => {
    const markup = readFileSync(new URL('../../components/card-routing-morph/markup.html', import.meta.url), 'utf8');
    const column = (name: string) => markup.slice(markup.indexOf(`data-motion="${name}"`));
    const left = column('col-left'), right = column('col-right');
    const order = (text: string, ids: string[]) => ids.map(id => text.indexOf(`class="card-routing-morph__cell`) >= 0 ? text.indexOf(`data-motion="${id}"`) : -1);
    const l = order(left, LEFT), r = order(right.slice(0, right.indexOf('card-routing-morph__bar')), RIGHT);
    expect(l.every(n => n > 0) && [...l].sort((a, b) => a - b).join() === l.join()).toBe(true);
    expect(r.every(n => n > 0) && [...r].sort((a, b) => a - b).join() === r.join()).toBe(true);
  });
});
