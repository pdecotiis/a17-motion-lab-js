import type { MotionVersion, SpringModel, LiveControls } from './types.js';
import { springToEasingString } from './spring-to-bezier.js';

export interface ResolvedTiming {
  duration: number;
  easing: string;
  delay: number;
  fill: FillMode;
}

function parseMs(value: string): number {
  if (value.endsWith('ms')) return parseFloat(value);
  if (value.endsWith('s')) return parseFloat(value) * 1000;
  return parseFloat(value);
}

function resolveValue(value: string | undefined, raw: Record<string, unknown>, fallback: string): string {
  if (!value) return fallback;
  if (value in raw) {
    const resolved = raw[value];
    if (typeof resolved === 'string') return resolved;
    if (Array.isArray(resolved)) {
      const [x1, y1, x2, y2] = resolved as number[];
      return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
    }
    if (typeof resolved === 'object' && resolved !== null && 'bounce' in resolved) {
      const s = resolved as { bounce: number; duration: number };
      return springToEasingString(s.bounce, s.duration);
    }
  }
  return value;
}

export function resolveTiming(
  version: MotionVersion,
  raw: Record<string, unknown>,
  controls: LiveControls = {},
  playbackRate = 1
): ResolvedTiming {
  const model = version.model;
  let durationStr: string;
  let easing: string;
  let delayStr: string;

  if (model.model === 'tween') {
    durationStr = controls.duration ?? resolveValue(model.duration, raw, '300ms');
    easing = controls.easing ?? resolveValue(model.easing, raw, 'ease');
    delayStr = controls.delay ?? resolveValue(model.delay, raw, '0ms');
  } else {
    const spring = model as SpringModel;
    const springRaw = raw[spring.duration] as { bounce: number; duration: number } | undefined;
    if (springRaw && typeof springRaw === 'object' && 'duration' in springRaw) {
      // Spring token: extract numeric duration and compute cubic-bezier easing
      durationStr = controls.duration ?? `${springRaw.duration}ms`;
      const bounce = springRaw.bounce;
      easing = controls.easing ?? springToEasingString(bounce, springRaw.duration);
    } else {
      // Literal duration string (e.g. "600ms")
      durationStr = controls.duration ?? resolveValue(spring.duration, raw, '400ms');
      easing = controls.easing ?? springToEasingString(spring.bounce, parseMs(durationStr));
    }
    delayStr = controls.delay ?? resolveValue(spring.delay, raw, '0ms');
  }

  const duration = parseMs(durationStr) / playbackRate;
  const delay = parseMs(delayStr) / playbackRate;

  return { duration, easing, delay, fill: 'both' };
}

export function buildAnimationOptions(timing: ResolvedTiming): KeyframeAnimationOptions {
  return {
    duration: timing.duration,
    easing: timing.easing,
    delay: timing.delay,
    fill: timing.fill,
  };
}

export function validateMotionVersion(version: MotionVersion): void {
  const allowed = new Set(['id', 'label', 'model', 'keyframes', 'stagger', 'status', 'reviewNotes', 'forkedFrom']);
  for (const key of Object.keys(version)) {
    if (!allowed.has(key)) {
      throw new Error(`MotionVersion "${version.id}" has disallowed property: "${key}"`);
    }
  }
  const structuralProps = ['display', 'position', 'width', 'height', 'content', 'innerHTML'];
  for (const kf of version.keyframes) {
    for (const prop of Object.keys(kf)) {
      if (prop === 'offset' || prop === 'easing' || prop === 'composite') continue;
      if (structuralProps.includes(prop)) {
        throw new Error(`MotionVersion "${version.id}" keyframe contains structural property: "${prop}"`);
      }
    }
  }
}
