import { deriveKind, type DerivedToken, type KindOptions } from './scales.js';
import { scaleKind, readScaleConfig, withScaleConfig, type Json, type ScaleKind, type ScaleConfig } from './scale-apply.js';

// Replacing the base tokens of a kind with a set of our own choosing, not only one a global scale generates: the
// Vitrine durations (50, 100, 150…), opacity of just 0 and 1, scale of just 90, 95 and 100%. Each old token goes
// to the new token with the closest value (see `Match` in scale-apply.ts), so a motion keeps its feel; `overrides`
// say where nearest is not what is wanted. Pure: scripts/tokens-remap.ts reads and writes the files.

export interface KindSpec {
  /** Generate the values from a scale (fibonacci, major-third…), as the global scale does. Recorded as the kind's scale. */
  scale?: string;
  options?: KindOptions;
  /** Or whole numbers: ms for duration and delay, px for distance. The kind is then Custom. */
  values?: number[];
  /** Or named number tokens (scale, opacity): the name is the percent, the value what it is (`{ name: "95", value: 0.95 }`). */
  tokens?: { name: string; value: number }[];
  /** Old name → new name, where the nearest value is not what is wanted (`"98": "95"`: a 98% press is a press, not 100%). */
  overrides?: Record<string, string>;
}
export type RemapSpec = Partial<Record<ScaleKind, KindSpec>>;

export interface Remap {
  tokens: Json;
  /** Old path → new path, for every token of every kind in the spec (including those that kept their name). */
  renames: Record<string, string>;
  /** Per kind: the new token names, for the summary. */
  names: Partial<Record<ScaleKind, string[]>>;
}

function derivedFor(kind: ScaleKind, spec: KindSpec): number[] | DerivedToken[] {
  const given = [spec.scale !== undefined, spec.values !== undefined, spec.tokens !== undefined].filter(Boolean).length;
  if (given !== 1) throw new Error(`${kind}: give exactly one of "scale", "values" or "tokens"`);
  if (spec.scale !== undefined) return deriveKind(kind, spec.scale, spec.options);
  if (spec.values) return spec.values;
  return spec.tokens!.map(t => ({ name: t.name, $type: 'number' as const, $value: t.value }));
}

export function applyRemap(tokens: Json, spec: RemapSpec): Remap {
  let next = tokens;
  const renames: Record<string, string> = {};
  const names: Partial<Record<ScaleKind, string[]>> = {};
  const record: ScaleConfig = {};
  const custom: ScaleKind[] = [];
  for (const [kind, kindSpec] of Object.entries(spec) as [ScaleKind, KindSpec][]) {
    const derived = derivedFor(kind, kindSpec);
    const result = scaleKind(next, kind, derived, { match: 'nearest', overrides: kindSpec.overrides ?? {} });
    next = result.tokens;
    Object.assign(renames, result.renames);
    names[kind] = Object.keys(next[kind] as Record<string, unknown>);
    if (kindSpec.scale !== undefined) record[kind] = { scale: kindSpec.scale, ...(kindSpec.options ?? {}) };
    else custom.push(kind);
  }
  // A kind set by hand follows no scale: forget the one it had.
  const kept = Object.fromEntries(Object.entries(readScaleConfig(next)).filter(([k]) => !custom.includes(k as ScaleKind))) as ScaleConfig;
  const ext = { ...((next['$extensions'] ?? {}) as Json) };
  delete ext['scale'];
  next = { ...next, $extensions: Object.keys(kept).length ? { ...ext, scale: { kinds: kept } } : ext };
  if (Object.keys(next['$extensions'] as Json).length === 0) delete next['$extensions'];
  return { tokens: withScaleConfig(next, record), renames, names };
}
