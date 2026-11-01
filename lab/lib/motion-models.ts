import type { MotionVersion, TweenModel, SpringModel, SpringProperty } from './types.js';
import { getEffectiveKeyframes, REDUCED_MOTION_FADE_MS } from './reduced-motion.js';
import { resolveRefs } from './token-compiler.js';
import { isVersionStatus, isTriggerType, isReducedMotionPolicy, TRIGGER_TYPES } from './version-meta.js';

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
  playbackRate = 1,
): ResolvedTiming {
  if (version.model.model !== 'tween') {
    throw new Error(`resolveTiming: version "${version.id}" is a spring model, which CSS plays through playbackOf`);
  }
  const model = version.model as TweenModel;
  const durationStr = resolveStr(model.duration, raw, '300ms');
  const easing = resolveStr(model.easing, raw, 'ease');
  const delayStr = resolveStr(model.delay, raw, '0ms');

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

// The motions of a version, each as a version of its own so everything that works on one motion
// (timing, usage, CSS) works on a layer too: the component's root first (name null), then each layer
// by its data-motion name. A layer shares the version's trigger, reduced-motion policy and stagger.
export function stepsOf(version: MotionVersion): { name: string | null; version: MotionVersion }[] {
  const { layers, ...root } = version;
  return [
    { name: null, version: root },
    ...Object.entries(layers ?? {}).map(([name, step]) => ({
      name,
      version: { ...root, model: step.model, keyframes: step.keyframes },
    })),
  ];
}

// A tween's keyframes with token references ("{distance.16}") replaced by their values.
export function resolveKeyframes(keyframes: Keyframe[] | undefined, raw: Record<string, unknown>): Keyframe[] {
  return (keyframes ?? []).map(kf =>
    Object.fromEntries(
      Object.entries(kf).map(([k, v]) => [k, typeof v === 'string' ? resolveRefs(v, raw) : v]),
    ) as Keyframe,
  );
}

// ── Playback ──────────────────────────────────────────────────────────────

export interface Playback {
  keyframes: Keyframe[];
  /** WAAPI duration in ms (already divided by the playback rate). */
  duration: number;
  delay: number;
  /** WAAPI easing: the easing token's cubic-bezier. */
  easing: string;
  easingToken: string;
  /** The duration token's ms. */
  pairedMs: number;
  /** Set when the motion was authored as a spring but CSS can only play its easing. */
  note?: string;
}

// A spring version's from/to values as two keyframes, to play it as an easing curve.
function springAsKeyframes(properties: SpringProperty[]): Keyframe[] {
  const start: Keyframe = { offset: 0 };
  const end: Keyframe = { offset: 1 };
  const startTransform: string[] = [];
  const endTransform: string[] = [];
  for (const p of properties) {
    const unit = p.unit ?? '';
    if (p.wrapTransform) {
      startTransform.push(`${p.wrapTransform}(${p.from}${unit})`);
      endTransform.push(`${p.wrapTransform}(${p.to}${unit})`);
    } else {
      (start as Record<string, unknown>)[p.property] = unit ? `${p.from}${unit}` : p.from;
      (end as Record<string, unknown>)[p.property] = unit ? `${p.to}${unit}` : p.to;
    }
  }
  if (startTransform.length) start.transform = startTransform.join(' ');
  if (endTransform.length) end.transform = endTransform.join(' ');
  return [start, end];
}

// How one motion plays in the lab's CSS runtime: its easing curve over its duration token. A spring
// version has no real spring here, so it plays its from/to values with the easing curve. Reduced
// motion gives the short opacity-only fade.
export function playbackOf(
  version: MotionVersion,
  raw: Record<string, unknown>,
  options: { playbackRate?: number; reducedMotion?: boolean } = {},
): Playback {
  const { playbackRate = 1, reducedMotion = false } = options;
  const model = version.model;
  const easingToken = model.easing;
  const pairedMs = parseMs(resolveStr(model.duration, raw, '300ms'));
  const delay = parseMs(resolveStr(model.delay, raw, '0ms')) / playbackRate;
  const keyframes = model.model === 'spring' ? springAsKeyframes(model.properties) : resolveKeyframes(version.keyframes, raw);
  const playback: Playback = {
    keyframes, duration: pairedMs / playbackRate, delay, easing: resolveStr(easingToken, raw, 'ease'), easingToken, pairedMs,
  };
  if (model.model === 'spring') playback.note = 'authored as a spring; CSS plays its easing';

  if (reducedMotion) {
    return {
      ...playback,
      keyframes: getEffectiveKeyframes(playback.keyframes, true),
      duration: Math.min(playback.duration, REDUCED_MOTION_FADE_MS),
    };
  }
  return playback;
}

// What a motion plays as, in a line: "Easing · productive-entrance, 220ms".
export function describePlayback(p: Playback): string {
  const text = `Easing · ${p.easingToken.slice(p.easingToken.indexOf('.') + 1)}, ${Math.round(p.pairedMs)}ms`;
  return p.note ? `${text} (${p.note})` : text;
}

export function validateMotionVersion(version: MotionVersion): void {
  const allowed = new Set(['id', 'label', 'model', 'keyframes', 'stagger', 'trigger', 'reducedMotion', 'layers', 'status', 'reviewNotes', 'forkedFrom', 'lineage']);
  for (const key of Object.keys(version)) {
    if (!allowed.has(key)) {
      throw new Error(`MotionVersion "${version.id}" has disallowed property: "${key}"`);
    }
  }

  if (version.status !== undefined && !isVersionStatus(version.status)) {
    throw new Error(`MotionVersion "${version.id}" has unknown status: "${String(version.status)}"`);
  }

  if (version.trigger !== undefined) {
    const { on, threshold, once } = version.trigger;
    if (!isTriggerType(on)) {
      throw new Error(`MotionVersion "${version.id}" has unknown trigger "${String(on)}" (use ${TRIGGER_TYPES.join(', ')})`);
    }
    if (threshold !== undefined) {
      if (on !== 'in-view') throw new Error(`MotionVersion "${version.id}" trigger threshold only applies to "in-view"`);
      if (typeof threshold !== 'number' || threshold < 0 || threshold > 1) {
        throw new Error(`MotionVersion "${version.id}" trigger threshold must be a number from 0 to 1`);
      }
    }
    if (once !== undefined && typeof once !== 'boolean') {
      throw new Error(`MotionVersion "${version.id}" trigger "once" must be true or false`);
    }
  }

  if (version.reducedMotion !== undefined && !isReducedMotionPolicy(version.reducedMotion)) {
    throw new Error(`MotionVersion "${version.id}" has unknown reducedMotion "${String(version.reducedMotion)}" (use fade or none)`);
  }

  if (version.model.model === 'tween') {
    const { duration, easing } = version.model;
    if (typeof duration !== 'string' || typeof easing !== 'string') {
      throw new Error(`MotionVersion "${version.id}" tween needs a duration and an easing`);
    }
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
    if (typeof model.duration !== 'string' || typeof model.easing !== 'string') {
      throw new Error(`MotionVersion "${version.id}" spring needs a duration and an easing`);
    }
    if (typeof model.bounce !== 'number' || model.bounce < 0 || model.bounce > 1) {
      throw new Error(`MotionVersion "${version.id}" spring bounce must be a number from 0 to 1`);
    }
  }

  // Each layer is a motion of its own, checked like the root. Its name is a data-motion value.
  for (const [name, step] of Object.entries(version.layers ?? {})) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      throw new Error(`MotionVersion "${version.id}" layer name "${name}" must be lowercase letters, numbers and hyphens, as in data-motion="${name}"`);
    }
    try {
      validateMotionVersion({ id: version.id, label: version.label, model: step.model, keyframes: step.keyframes });
    } catch (e) {
      throw new Error(`${(e as Error).message} (layer "${name}")`);
    }
  }
}
