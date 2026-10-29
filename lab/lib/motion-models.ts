import type { MotionVersion, TweenModel, SpringModel, SpringProperty, LiveControls } from './types.js';
import { springKeyframes, springToCubicBezierString } from './spring-engine.js';

export interface ResolvedTiming {
  duration: number;
  easing: string;
  delay: number;
  fill: FillMode;
}

export interface SpringWaapiResult {
  keyframes: Keyframe[];
  duration: number;
  delay: number;
  easing?: string;  // set by CSS mode; undefined = use 'linear' (shape baked into keyframes)
}

function parseMs(value: string): number {
  if (value.endsWith('ms')) return parseFloat(value);
  if (value.endsWith('s')) return parseFloat(value) * 1000;
  return parseFloat(value);
}

function resolveStr(value: string | undefined, raw: Record<string, unknown>, fallback: string): string {
  if (!value) return fallback;
  if (value in raw) {
    const resolved = raw[value];
    if (typeof resolved === 'string') return resolved;
    if (Array.isArray(resolved)) {
      const [x1, y1, x2, y2] = resolved as number[];
      return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
    }
  }
  return value;
}

// resolveTiming is for tween models only → WAAPI with cubic-bezier easing.
export function resolveTiming(
  version: MotionVersion,
  raw: Record<string, unknown>,
  controls: LiveControls = {},
  playbackRate = 1,
): ResolvedTiming {
  if (version.model.model !== 'tween') {
    throw new Error(`resolveTiming: version "${version.id}" is a spring model — use buildSpringWaapiKeyframes instead`);
  }
  const model = version.model as TweenModel;
  const durationStr = controls.duration ?? resolveStr(model.duration, raw, '300ms');
  const easing = controls.easing ?? resolveStr(model.easing, raw, 'ease');
  const delayStr = controls.delay ?? resolveStr(model.delay, raw, '0ms');

  return {
    duration: parseMs(durationStr) / playbackRate,
    easing,
    delay: parseMs(delayStr) / playbackRate,
    fill: 'both',
  };
}

export function buildAnimationOptions(timing: ResolvedTiming): KeyframeAnimationOptions {
  return {
    duration: timing.duration,
    easing: timing.easing,
    delay: timing.delay,
    fill: timing.fill,
  };
}

// Build WAAPI keyframes from the spring simulation for entrance animations.
// Each property in model.properties is simulated (or linearly interpolated).
// The easing on the WAAPI animation is always 'linear' — the shape is baked into the keyframes.
export function buildSpringWaapiKeyframes(
  version: MotionVersion,
  raw: Record<string, unknown>,
  options: { controls?: LiveControls; playbackRate?: number; reducedMotion?: boolean } = {},
): SpringWaapiResult {
  if (version.model.model !== 'spring') {
    throw new Error(`buildSpringWaapiKeyframes: version "${version.id}" is not a spring model`);
  }
  const model = version.model as SpringModel;
  const { controls = {}, playbackRate = 1, reducedMotion = false } = options;

  // Resolve natural duration (ms) and bounce from token or literal
  const tokenVal = model.duration in raw ? raw[model.duration] : null;
  let naturalDuration: number;
  if (tokenVal && typeof tokenVal === 'object' && 'duration' in tokenVal) {
    naturalDuration = (tokenVal as { duration: number }).duration;
  } else if (typeof tokenVal === 'string') {
    naturalDuration = parseMs(tokenVal);
  } else {
    naturalDuration = parseMs(model.duration);
  }
  if (controls.duration) naturalDuration = parseMs(controls.duration);

  // Resolve delay
  const delayStr = controls.delay ?? resolveStr(model.delay, raw, '0ms');
  const delay = parseMs(delayStr) / playbackRate;

  const bounce = model.bounce;

  // Reduced motion: skip travel (transforms), keep opacity fade.
  if (reducedMotion) {
    const opacityProp = model.properties.find(p => p.property === 'opacity');
    const endTransformParts: string[] = [];
    for (const prop of model.properties) {
      if (prop.wrapTransform) {
        endTransformParts.push(`${prop.wrapTransform}(${prop.to}${prop.unit ?? ''})`);
      }
    }
    const endTransform = endTransformParts.length ? endTransformParts.join(' ') : undefined;

    if (opacityProp) {
      const startKf: Keyframe = { offset: 0, opacity: opacityProp.from };
      const endKf: Keyframe = { offset: 1, opacity: opacityProp.to };
      if (endTransform) { startKf.transform = endTransform; endKf.transform = endTransform; }
      return { keyframes: [startKf, endKf], duration: 150, delay };
    }
    return {
      keyframes: [{ offset: 1, ...(endTransform ? { transform: endTransform } : {}) }],
      duration: 0,
      delay,
    };
  }

  // Run spring simulation for each property
  const fps = 60;
  const simResults: { prop: SpringProperty; values: number[]; settleDuration: number }[] = [];

  for (const prop of model.properties) {
    if (prop.useSpring === false) {
      simResults.push({ prop, values: [prop.from, prop.to], settleDuration: naturalDuration });
    } else {
      const result = springKeyframes({
        from: prop.from,
        to: prop.to,
        duration: naturalDuration,
        bounce,
        span: prop.span ?? 1,
        fps,
      });
      simResults.push({ prop, values: result.keyframes, settleDuration: result.duration });
    }
  }

  const maxFrames = Math.max(...simResults.map(r => r.values.length));
  const settleDuration = Math.max(...simResults.map(r => r.settleDuration));

  // Build WAAPI keyframe array — easing will be 'linear', shape is in the values.
  const keyframes: Keyframe[] = [];
  for (let i = 0; i < maxFrames; i++) {
    const offset = maxFrames === 1 ? 0 : i / (maxFrames - 1);
    const kf: Keyframe = { offset };
    const transformParts: string[] = [];

    for (const { prop, values } of simResults) {
      // Map this frame index into the property's value array via linear interpolation
      const frameT = maxFrames === 1 ? 1 : i / (maxFrames - 1);
      const propT = frameT * (values.length - 1);
      const lo = Math.floor(propT);
      const hi = Math.min(Math.ceil(propT), values.length - 1);
      const frac = propT - lo;
      const loVal = values[lo] ?? prop.to;
      const hiVal = values[hi] ?? prop.to;
      const value = lo === hi ? loVal : loVal + (hiVal - loVal) * frac;

      const unit = prop.unit ?? '';
      if (prop.wrapTransform) {
        transformParts.push(`${prop.wrapTransform}(${value}${unit})`);
      } else if (unit === '') {
        // Numeric property (opacity, scale via custom prop, etc.)
        (kf as Record<string, unknown>)[prop.property] = value;
      } else {
        (kf as Record<string, unknown>)[prop.property] = `${value}${unit}`;
      }
    }

    if (transformParts.length) kf.transform = transformParts.join(' ');
    keyframes.push(kf);
  }

  return { keyframes, duration: settleDuration / playbackRate, delay };
}

// CSS fallback for spring versions: 2-frame WAAPI animation with cubic-bezier easing
// derived from the spring's bounce. Same from/to values, same duration — no simulation.
export function buildSpringCssKeyframes(
  version: MotionVersion,
  raw: Record<string, unknown>,
  options: { controls?: LiveControls; playbackRate?: number; reducedMotion?: boolean } = {},
): SpringWaapiResult {
  if (version.model.model !== 'spring') {
    throw new Error(`buildSpringCssKeyframes: version "${version.id}" is not a spring model`);
  }
  const model = version.model as SpringModel;
  const { controls = {}, playbackRate = 1, reducedMotion = false } = options;

  const tokenVal = model.duration in raw ? raw[model.duration] : null;
  let naturalDuration: number;
  if (tokenVal && typeof tokenVal === 'object' && 'duration' in tokenVal) {
    naturalDuration = (tokenVal as { duration: number }).duration;
  } else if (typeof tokenVal === 'string') {
    naturalDuration = parseMs(tokenVal);
  } else {
    naturalDuration = parseMs(model.duration);
  }
  if (controls.duration) naturalDuration = parseMs(controls.duration);

  const delayStr = controls.delay ?? resolveStr(model.delay, raw, '0ms');
  const delay = parseMs(delayStr) / playbackRate;
  const duration = naturalDuration / playbackRate;

  const easing = controls.easing ?? springToCubicBezierString(model.bounce);

  // Build 2-frame keyframes from property from/to values
  const startKf: Keyframe = { offset: 0 };
  const endKf: Keyframe = { offset: 1 };
  const startTransform: string[] = [];
  const endTransform: string[] = [];

  for (const prop of model.properties) {
    const unit = prop.unit ?? '';
    if (prop.wrapTransform) {
      startTransform.push(`${prop.wrapTransform}(${prop.from}${unit})`);
      endTransform.push(`${prop.wrapTransform}(${prop.to}${unit})`);
    } else if (!unit) {
      (startKf as Record<string, unknown>)[prop.property] = prop.from;
      (endKf as Record<string, unknown>)[prop.property] = prop.to;
    } else {
      (startKf as Record<string, unknown>)[prop.property] = `${prop.from}${unit}`;
      (endKf as Record<string, unknown>)[prop.property] = `${prop.to}${unit}`;
    }
  }
  if (startTransform.length) startKf.transform = startTransform.join(' ');
  if (endTransform.length) endKf.transform = endTransform.join(' ');

  if (reducedMotion) {
    const opacityProp = model.properties.find(p => p.property === 'opacity');
    if (opacityProp) {
      const rStart: Keyframe = { offset: 0, opacity: opacityProp.from };
      const rEnd: Keyframe = { offset: 1, opacity: opacityProp.to };
      if (endKf.transform) { rStart.transform = endKf.transform; rEnd.transform = endKf.transform; }
      return { keyframes: [rStart, rEnd], duration: 150, delay };
    }
    return { keyframes: [endKf], duration: 0, delay };
  }

  return { keyframes: [startKf, endKf], duration, delay, easing };
}

export function validateMotionVersion(version: MotionVersion): void {
  const allowed = new Set(['id', 'label', 'model', 'keyframes', 'stagger', 'status', 'reviewNotes', 'forkedFrom', 'lineage']);
  for (const key of Object.keys(version)) {
    if (!allowed.has(key)) {
      throw new Error(`MotionVersion "${version.id}" has disallowed property: "${key}"`);
    }
  }

  if (version.model.model === 'tween') {
    const kfs = version.keyframes ?? [];
    const structuralProps = ['display', 'position', 'width', 'height', 'content', 'innerHTML'];
    for (const kf of kfs) {
      for (const prop of Object.keys(kf)) {
        if (prop === 'offset' || prop === 'easing' || prop === 'composite') continue;
        if (structuralProps.includes(prop)) {
          throw new Error(`MotionVersion "${version.id}" keyframe contains structural property: "${prop}"`);
        }
      }
    }
  } else {
    const model = version.model as SpringModel;
    if (!Array.isArray(model.properties) || model.properties.length === 0) {
      throw new Error(`MotionVersion "${version.id}" spring model must have a non-empty properties array`);
    }
  }
}
