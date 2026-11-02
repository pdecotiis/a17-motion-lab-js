import { describe, it, expect } from 'vitest';
import { bezierCurve, springCurve, curvePath, curveYAt, toX, toY } from '../../lab/lib/curve.js';

describe('bezierCurve', () => {
  it('a linear easing is the diagonal', () => {
    const c = bezierCurve([0, 0, 1, 1]);
    expect(c.yMin).toBe(0);
    expect(c.yMax).toBe(1);
    for (const p of c.points) expect(p.y).toBeCloseTo(p.x, 2);
  });

  it('starts at 0 and ends at 1, and ease-out is ahead of linear at the midpoint', () => {
    const c = bezierCurve([0, 0, 0.2, 1]);
    expect(c.points[0]).toEqual({ x: 0, y: 0 });
    expect(c.points.at(-1)).toEqual({ x: 1, y: 1 });
    expect(curveYAt(c, 0.5)).toBeGreaterThan(0.5);
  });

  it('an easing with a control point above 1 overshoots, and the range grows to fit it', () => {
    const c = bezierCurve([0.34, 1.56, 0.64, 1]);
    expect(c.yMax).toBeGreaterThan(1);
    expect(c.yMin).toBe(0);
  });
});

describe('springCurve (Motion\'s own spring)', () => {
  it('no bounce does not overshoot; more bounce overshoots further', () => {
    expect(springCurve(0, 600).yMax).toBeCloseTo(1, 2);
    expect(springCurve(0.5, 600).yMax).toBeGreaterThan(springCurve(0.25, 600).yMax);
    expect(springCurve(0.25, 600).yMax).toBeGreaterThan(1);
  });

  it('starts at 0 and settles at 1', () => {
    const c = springCurve(0.25, 600);
    expect(c.points[0]).toEqual({ x: 0, y: 0 });
    expect(c.points.at(-1)).toEqual({ x: 1, y: 1 });
    expect(c.durationMs).toBeGreaterThan(0);
  });
});

describe('drawing', () => {
  const c = bezierCurve([0.34, 1.56, 0.64, 1], 10);

  it('builds a path with one command per point', () => {
    const d = curvePath(c, 100, 80, 8);
    expect(d.startsWith('M')).toBe(true);
    expect(d.match(/[ML]/g)).toHaveLength(c.points.length);
  });

  it('maps 1 above 0 and keeps everything inside the padded box, overshoot included', () => {
    expect(toY(c, 1, 80, 8)).toBeLessThan(toY(c, 0, 80, 8));
    for (const p of c.points) {
      expect(toY(c, p.y, 80, 8)).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(toY(c, p.y, 80, 8)).toBeLessThanOrEqual(72 + 1e-9);
    }
    expect(toX(0, 100, 8)).toBe(8);
    expect(toX(1, 100, 8)).toBe(92);
  });

  it('interpolates progress at a point in time', () => {
    const linear = bezierCurve([0, 0, 1, 1]);
    expect(curveYAt(linear, 0)).toBe(0);
    expect(curveYAt(linear, 0.5)).toBeCloseTo(0.5, 2);
    expect(curveYAt(linear, 1)).toBe(1);
    expect(curveYAt(linear, 2)).toBe(1);
  });
});
