// Approximates spring physics as a cubic-bezier for Web Animations API.
// Higher bounce → more overshoot in y control points.
export function springToCubicBezier(bounce: number, _duration: number): [number, number, number, number] {
  const b = Math.max(0, Math.min(1, bounce));
  const overshoot = b * 0.6;
  return [0.34, 1.0 + overshoot, 0.64, 1.0];
}

export function springToEasingString(bounce: number, duration: number): string {
  const [x1, y1, x2, y2] = springToCubicBezier(bounce, duration);
  return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}
