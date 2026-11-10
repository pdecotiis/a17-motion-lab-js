import type { MotionVersion, EntranceVersion, MotionModel, TweenModel, SpringModel, SpringProperty, LayerStep } from './types.js';
import { isPresetName, presetTracks, type PresetName, type PresetStep, type PresetTrackName } from './entrance-presets.js';
import { getEffectiveKeyframes, REDUCED_MOTION_FADE_MS } from './reduced-motion.js';
import { resolveRefs } from './token-compiler.js';
import { resolveBounce } from './bounce.js';
import { partProps, validateInteraction } from './interaction.js';
import { hasPresetInteraction, PRESET_INTERACTION_PROPS } from './preset-interaction.js';
import { isTriggerType, isReducedMotionPolicy, TRIGGER_TYPES } from './version-meta.js';

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
  if (modelOf(version).model !== 'tween') {
    throw new Error(`resolveTiming: version "${version.id}" is a spring model, which CSS plays through playbackOf`);
  }
  const model = modelOf(version) as TweenModel;
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
// The model a version plays: its own, or for an interaction version with none, the timing of its first
// transition (into the first state after the resting one), as a tween: what the panels show for it.
export function modelOf(version: MotionVersion): MotionModel {
  if (version.model) return version.model;
  const i = version.interaction;
  if (i) {
    const first = Object.keys(i.states).find(s => s !== i.initial) ?? i.initial;
    const t = i.transitions[first];
    if (t) return { model: 'tween', duration: t.duration, easing: t.easing, ...(t.delay ? { delay: t.delay } : {}) };
  }
  throw new Error(`MotionVersion "${version.id}" has no model and no interaction`);
}

/**
 * Whether a version has an entrance: a motion that plays when the component appears. A version with a
 * `model` does, whether or not it also has `interaction` (the entrance, then the states: hover, press…).
 * An interaction version with no `model` has no entrance.
 */
export function hasEntrance(version: MotionVersion): boolean {
  return version.model !== undefined || version.entrance !== undefined;
}

export function isPresetStep(step: LayerStep): step is PresetStep {
  return 'preset' in step;
}

/** One motion of an entrance. A preset is up to two (its fade and its move) on the same element. */
export interface StepEntry {
  /** The data-motion name of the element, or null for the component root. */
  name: string | null;
  version: EntranceVersion;
  /** Set when the motion is part of a preset (see entrance-presets.ts): which track of it. */
  track?: PresetTrackName;
  preset?: PresetName;
  /** A delay token: each matching element starts this much after the one before. */
  elementStagger?: string;
}

function presetEntries(name: string | null, step: PresetStep, root: MotionVersion): StepEntry[] {
  return presetTracks(step.preset, step.delay).map(t => ({
    name,
    track: t.track,
    preset: step.preset,
    ...(step.stagger ? { elementStagger: step.stagger } : {}),
    version: { ...root, model: t.model, ...(t.keyframes ? { keyframes: t.keyframes as Keyframe[] } : {}) },
  }));
}

export function stepsOf(version: MotionVersion): StepEntry[] {
  const { layers, interaction, entrance, ...rest } = version;
  // A version with an entrance and states keeps them apart: its steps are the entrance's (root and layers).
  // An interaction-only version's root step carries the interaction, which is where its timing comes from.
  const root = version.model !== undefined || interaction === undefined ? rest : { ...rest, interaction };
  return [
    ...(entrance ? presetEntries(null, entrance, root) : [{ name: null, version: { ...root, model: modelOf(version) } }]),
    ...Object.entries(layers ?? {}).flatMap(([name, step]): StepEntry[] => (isPresetStep(step)
      ? presetEntries(name, step, root)
      : [{ name, version: { ...root, model: step.model, keyframes: step.keyframes } }])),
  ];
}

// A tween's keyframes with token references ("{distance.20}") replaced by their values.
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
  const model = modelOf(version);
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

export { resolveBounce };

function validatePresetStep(id: string, step: PresetStep, where: string): void {
  if (!isPresetName(step.preset)) throw new Error(`MotionVersion "${id}" ${where} names an unknown preset "${String(step.preset)}"`);
  for (const key of Object.keys(step)) {
    if (!['preset', 'delay', 'stagger'].includes(key)) throw new Error(`MotionVersion "${id}" ${where} has disallowed property "${key}": a preset takes only preset, delay and stagger`);
  }
  for (const key of ['delay', 'stagger'] as const) {
    if (step[key] !== undefined && typeof step[key] !== 'string') throw new Error(`MotionVersion "${id}" ${where} ${key} must be a delay token or a time such as "70ms"`);
  }
}

// Elements that use a preset's hover and press. Each names an element (a data-motion value, or `root`: the component itself, such as a card that is pressed) and a preset that has an interaction. An element's
// presets move filter and transform, so the component's own states may not set either on the same layer (the two would fight).
function validateElements(version: MotionVersion): void {
  if (version.elements === undefined) return;
  if (typeof version.elements !== 'object' || version.elements === null || Array.isArray(version.elements)) throw new Error(`MotionVersion "${version.id}" elements must be an object: { "<data-motion name>": "<preset>" }`);
  for (const [name, preset] of Object.entries(version.elements)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new Error(`MotionVersion "${version.id}" element name "${name}" must be lowercase letters, numbers and hyphens, as in data-motion="${name}"`);
    if (!isPresetName(preset)) throw new Error(`MotionVersion "${version.id}" element "${name}" names an unknown preset "${String(preset)}"`);
    if (!hasPresetInteraction(preset)) throw new Error(`MotionVersion "${version.id}" element "${name}": the preset "${preset}" has no hover or press (add "interaction" to it in tokens/presets.json)`);
    const own = version.interaction ? partProps(version.interaction, name === 'root' ? null : name) : [];
    const clash = own.filter(p => (PRESET_INTERACTION_PROPS as readonly string[]).includes(p));
    if (clash.length) throw new Error(`MotionVersion "${version.id}" element "${name}" uses the "${preset}" preset, which sets ${clash.join(' and ')}, and the component's own states set ${clash.join(' and ')} on it too: give them different elements`);
  }
}

export function validateMotionVersion(version: MotionVersion): void {
  const allowed = new Set(['id', 'label', 'model', 'keyframes', 'stagger', 'trigger', 'reducedMotion', 'layers', 'entrance', 'interaction', 'elements', 'reviewNotes', 'forkedFrom', 'lineage']);
  for (const key of Object.keys(version)) {
    if (!allowed.has(key)) {
      throw new Error(`MotionVersion "${version.id}" has disallowed property: "${key}"`);
    }
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

  validateInteraction(version);
  validateElements(version);

  if (version.entrance !== undefined) {
    if (version.model !== undefined || version.keyframes !== undefined) {
      throw new Error(`MotionVersion "${version.id}" has an entrance preset and a model: use one or the other`);
    }
    validatePresetStep(version.id, version.entrance, 'entrance');
  }

  const model0 = version.model;
  if (model0 === undefined) {
    if (!version.interaction && !version.entrance) throw new Error(`MotionVersion "${version.id}" needs a model, an entrance preset, or an interaction`);
  } else if (model0.model === 'tween') {
    const { duration, easing } = model0;
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
    const model = model0 as SpringModel;
    if (!Array.isArray(model.properties) || model.properties.length === 0) {
      throw new Error(`MotionVersion "${version.id}" spring model must have a non-empty properties array`);
    }
    if (typeof model.duration !== 'string' || typeof model.easing !== 'string') {
      throw new Error(`MotionVersion "${version.id}" spring needs a duration and an easing`);
    }
    if (model.bounce !== undefined && !(typeof model.bounce === 'string' && model.bounce !== '')
      && !(typeof model.bounce === 'number' && model.bounce >= 0 && model.bounce <= 1)) {
      throw new Error(`MotionVersion "${version.id}" spring bounce must be a bounce token or a number from 0 to 1`);
    }
  }

  // Each layer is a motion of its own, checked like the root. Its name is a data-motion value.
  for (const [name, step] of Object.entries(version.layers ?? {})) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      throw new Error(`MotionVersion "${version.id}" layer name "${name}" must be lowercase letters, numbers and hyphens, as in data-motion="${name}"`);
    }
    if (isPresetStep(step)) {
      validatePresetStep(version.id, step, `layer "${name}"`);
      continue;
    }
    try {
      validateMotionVersion({ id: version.id, label: version.label, model: step.model, keyframes: step.keyframes });
    } catch (e) {
      throw new Error(`${(e as Error).message} (layer "${name}")`);
    }
  }
}
