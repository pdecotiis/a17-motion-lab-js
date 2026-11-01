// A motion curve for the Tokens view: progress (y) over time (x), the classic easing graph.
// x runs 0 → 1 across the duration; y runs 0 → 1 and may leave that range when the motion
// overshoots (an easing with a control point above 1).

export interface Curve {
  points: { x: number; y: number }[];
  yMin: number;
  yMax: number;
  /** How long the motion takes, in ms. Zero when the curve alone doesn't say (an easing token). */
  durationMs: number;
}

function withRange(points: { x: number; y: number }[], durationMs: number): Curve {
  const ys = points.map(p => p.y);
  return { points, yMin: Math.min(0, ...ys), yMax: Math.max(1, ...ys), durationMs };
}

// A cubic-bezier easing, sampled along the curve.
export function bezierCurve(
  [x1, y1, x2, y2]: readonly [number, number, number, number],
  samples = 48,
): Curve {
  const bez = (a: number, b: number, s: number): number =>
    3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s ** 2 * b + s ** 3;
  const points = Array.from({ length: samples + 1 }, (_, i) => {
    const s = i / samples;
    return { x: bez(x1, x2, s), y: bez(y1, y2, s) };
  });
  return withRange(points, 0);
}

// An SVG path for the curve inside a width × height box with `pad` around it.
// The box always shows 0 and 1 on the y axis, plus any overshoot.
export function curvePath(curve: Curve, width: number, height: number, pad = 6): string {
  return curve.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.x, width, pad).toFixed(1)} ${toY(curve, p.y, height, pad).toFixed(1)}`)
    .join(' ');
}

export function toX(x: number, width: number, pad = 6): number {
  return pad + x * (width - 2 * pad);
}

export function toY(curve: Curve, y: number, height: number, pad = 6): number {
  const span = curve.yMax - curve.yMin || 1;
  return pad + (1 - (y - curve.yMin) / span) * (height - 2 * pad);
}

// The curve's y at time t (0–1), interpolated. Used to move a dot along the curve.
export function curveYAt(curve: Curve, t: number): number {
  const pts = curve.points;
  if (t <= pts[0]!.x) return pts[0]!.y;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (t <= b.x) {
      const f = b.x === a.x ? 1 : (t - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * f;
    }
  }
  return pts[pts.length - 1]!.y;
}
