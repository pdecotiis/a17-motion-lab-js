import { describe, it, expect } from 'vitest';
import sequence from '../../triggers/sequence';
import { getTrigger } from '../../lab/lib/project-triggers.js';
import { validateInteraction } from '../../lab/lib/interaction.js';
import type { MotionVersion } from '../../lab/lib/types.js';

const T = { model: 'tween' as const, duration: 'duration.220', easing: 'easing.productive-standard' };
const version = (steps: unknown): MotionVersion => ({
  id: 'v1', label: 'x', lineage: 'test',
  interaction: { initial: 'a', states: { a: {}, b: {}, c: {} }, transitions: { a: T, b: T, c: T }, triggers: [{ on: 'sequence', steps } as never] },
});

describe('the sequence project trigger (triggers/sequence.ts)', () => {
  it('is found by the lab and accepts a list of [state, time] steps', () => {
    expect(getTrigger('sequence')).toBe(sequence);
    expect(() => validateInteraction(version([['b', '250ms'], ['c', '500ms']]))).not.toThrow();
  });
  it('refuses no steps, a step that is not a pair, and a state it does not have', () => {
    expect(() => validateInteraction(version([]))).toThrow('needs "steps"');
    expect(() => validateInteraction(version([['b']]))).toThrow('[state, time] pairs');
    expect(() => validateInteraction(version([['lost', '250ms']]))).toThrow('"lost", which is not one of its states');
  });
  it('writes times as numbers in the exported code, and says what it does', () => {
    expect(sequence.exportSettings!({ on: 'sequence', steps: [['b', '250ms'], ['c', '1s']] }, {})['steps']).toEqual([['b', 250], ['c', 1000]]);
    expect(sequence.describe({ on: 'sequence', steps: [['b', '250ms'], ['c', '500ms']] }).summary).toContain('b at 250ms, then c at 500ms');
  });
});
