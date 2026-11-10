import { describe, it, expect } from 'vitest';
import { validateInteraction } from '../../lab/lib/interaction.js';
import type { MotionVersion } from '../../lab/lib/types.js';

// A click trigger's `toggle` can list more than two states: each click goes to the next, back to the first after the last.
const T = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.productive-standard' };
const version = (toggle: string[]): MotionVersion => ({
  id: 'v1', label: 'x', lineage: 'test',
  interaction: { initial: 'a', states: { a: {}, b: {}, c: {} }, transitions: { a: T, b: T, c: T }, triggers: [{ on: 'click', toggle: toggle as [string, string, ...string[]], target: 'btn' }] },
} as MotionVersion);

describe('click toggle with three or more states', () => {
  it('accepts a cycle of known, different states', () => {
    expect(() => validateInteraction(version(['b', 'c', 'a']))).not.toThrow();
    expect(() => validateInteraction(version(['a', 'b']))).not.toThrow();
  });
  it('refuses one state, a repeat, and an unknown state', () => {
    expect(() => validateInteraction(version(['a']))).toThrow(/two or more different states/);
    expect(() => validateInteraction(version(['a', 'b', 'a']))).toThrow(/two or more different states/);
    expect(() => validateInteraction(version(['a', 'z']))).toThrow(/"z"/);
  });
});
