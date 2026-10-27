// Motion Lab spring engine (from build 20261030.1)
// Source of truth for all spring motion. Same parameters, same integrator, same settle rules.

export interface SpringPhysics {
  stiffness: number;
  damping: number;
  mass: number;
}

// Duration (ms) + bounce → physical spring. Mass is always 1.
// stiffness = (2π / d)², damping = 4π(1 − b) / d, with d in seconds.
export function springPhysics({ duration, bounce = 0 }: { duration: number; bounce?: number }): SpringPhysics {
  const d = Math.max(0.05, duration / 1000);
  const b = Math.min(0.9, bounce);
  return {
    stiffness: Math.pow((2 * Math.PI) / d, 2),
    damping: (4 * Math.PI * (1 - b)) / d,
    mass: 1,
  };
}

// One frame: semi-implicit Euler, 4 substeps. dt in seconds.
export function step(
  x: number,
  v: number,
  target: number,
  phys: SpringPhysics,
  dt: number,
): [number, number] {
  const h = dt / 4;
  for (let i = 0; i < 4; i++) {
    const a = -phys.stiffness * (x - target) - phys.damping * v;
    v += a * h;
    x += v * h;
  }
  return [x, v];
}

// Settled when within 0.1% of span and velocity below 1% of span.
// span: 20 for pixel values (x, y, width, height), 1 for unitless (opacity, scale).
export function isSettled(x: number, v: number, target: number, span = 1): boolean {
  return Math.abs(x - target) < span * 1e-3 && Math.abs(v) < span * 1e-2;
}

export interface SpringHandle {
  to(target: number): void;
  stop(): void;
  readonly value: number;
  readonly velocity: number;
}

export interface CreateSpringOptions {
  from?: number;
  duration: number;
  bounce?: number;
  span?: number;
  speed?: number;
  onUpdate: (value: number) => void;
  reduced?: boolean;
}

// Animate one value on requestAnimationFrame. Call .to(newTarget) at any time;
// velocity carries through retargets. speed: playback rate (1 = normal).
export function createSpring({
  from = 0,
  duration,
  bounce = 0,
  span = 1,
  speed = 1,
  onUpdate,
  reduced = false,
}: CreateSpringOptions): SpringHandle {
  const phys = springPhysics({ duration, bounce });
  let x = from, v = 0, target = from, raf = 0, last = 0;

  const tick = (now: number) => {
    const dt = Math.min(0.064, (now - last) / 1000) * speed;
    last = now;
    [x, v] = step(x, v, target, phys, dt);
    if (isSettled(x, v, target, span)) {
      x = target;
      v = 0;
      raf = 0;
      onUpdate(x);
      return;
    }
    onUpdate(x);
    raf = requestAnimationFrame(tick);
  };

  return {
    to(t: number) {
      target = t;
      if (reduced) { x = t; v = 0; onUpdate(x); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    get value() { return x; },
    get velocity() { return v; },
  };
}

export interface SpringKeyframesOptions {
  from: number;
  to: number;
  duration: number;
  bounce?: number;
  span?: number;
  fps?: number;
  maxMs?: number;
}

export interface SpringKeyframesResult {
  keyframes: number[];
  duration: number;
}

// Sample the spring into Web Animations keyframes (no retargeting).
// Returns { keyframes: number[], duration: ms } at 60fps.
export function springKeyframes({
  from,
  to,
  duration,
  bounce = 0,
  span = 1,
  fps = 60,
  maxMs = 3000,
}: SpringKeyframesOptions): SpringKeyframesResult {
  const phys = springPhysics({ duration, bounce });
  const dt = 1 / fps;
  const out = [from];
  let x = from, v = 0;
  for (let t = 0; t < maxMs / 1000; t += dt) {
    [x, v] = step(x, v, to, phys, dt);
    out.push(x);
    if (isSettled(x, v, to, span)) {
      out[out.length - 1] = to;
      break;
    }
  }
  return { keyframes: out, duration: (out.length - 1) * dt * 1000 };
}
