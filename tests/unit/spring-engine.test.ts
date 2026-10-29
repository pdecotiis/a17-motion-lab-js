import { describe, it, expect } from 'vitest';
import { springToLinear, springKeyframes } from '../../lab/lib/spring-engine.js';

describe('springToLinear', () => {
  it('returns a string starting with "linear(" and ending with ")"', () => {
    const result = springToLinear(300, 0);
    expect(result.startsWith('linear(')).toBe(true);
    expect(result.endsWith(')')).toBe(true);
  });

  it('first value is 0 (spring starts at from=0)', () => {
    const result = springToLinear(300, 0, 20);
    const inner = result.slice('linear('.length, -1);
    const first = parseFloat(inner.split(', ')[0]!);
    expect(first).toBeCloseTo(0, 4);
  });

  it('last value is 1 (spring ends at to=1)', () => {
    const result = springToLinear(300, 0, 20);
    const inner = result.slice('linear('.length, -1);
    const parts = inner.split(', ');
    const last = parseFloat(parts[parts.length - 1]!);
    expect(last).toBeCloseTo(1, 4);
  });

  it('produces steps+1 sample points', () => {
    const steps = 15;
    const result = springToLinear(300, 0, steps);
    const inner = result.slice('linear('.length, -1);
    const parts = inner.split(', ');
    expect(parts.length).toBe(steps + 1);
  });

  it('sampled values match the spring engine within 2% tolerance', () => {
    const duration = 400;
    const bounce = 0.2;
    const steps = 20;
    const { keyframes: frames } = springKeyframes({ from: 0, to: 1, duration, bounce, span: 1 });

    const result = springToLinear(duration, bounce, steps);
    const inner = result.slice('linear('.length, -1);
    const parts = inner.split(', ');

    // Check the midpoint (step 10 out of 20 = 50%)
    const midPart = parts[10]!;
    const midVal = parseFloat(midPart.split(' ')[0]!);

    const midFrameIdx = 0.5 * (frames.length - 1);
    const lo = Math.floor(midFrameIdx);
    const hi = Math.ceil(midFrameIdx);
    const frac = midFrameIdx - lo;
    const springMid = (frames[lo] ?? 0) + ((frames[hi] ?? 0) - (frames[lo] ?? 0)) * frac;

    expect(Math.abs(midVal - springMid)).toBeLessThan(0.02);
  });

  it('spring with bounce=0.4 produces overshoot above 1.0', () => {
    const result = springToLinear(600, 0.4, 60);
    const inner = result.slice('linear('.length, -1);
    const vals = inner.split(', ').map(p => parseFloat(p.split(' ')[0]!));
    const maxVal = Math.max(...vals);
    expect(maxVal).toBeGreaterThan(1.0);
  });

  it('spring with bounce=0 produces no overshoot', () => {
    const result = springToLinear(300, 0, 60);
    const inner = result.slice('linear('.length, -1);
    const vals = inner.split(', ').map(p => parseFloat(p.split(' ')[0]!));
    const maxVal = Math.max(...vals);
    // No bounce: values should monotonically approach 1, never exceeding it
    expect(maxVal).toBeLessThanOrEqual(1.001);
  });

  it('interior sample points include percentage labels', () => {
    const result = springToLinear(300, 0, 10);
    const inner = result.slice('linear('.length, -1);
    const parts = inner.split(', ');
    // Interior points (not first/last) should have a percentage
    const interior = parts.slice(1, -1);
    for (const p of interior) {
      expect(p).toContain('%');
    }
    // First and last should not have percentages
    expect(parts[0]).not.toContain('%');
    expect(parts[parts.length - 1]).not.toContain('%');
  });
});
