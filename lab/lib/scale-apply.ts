import { scaleValues, deriveKind, GLOBAL_SCALE_KINDS, type DerivedToken, type GlobalScaleKind, type KindOptions } from './scales.js';

// Applying a scale to a token file, in memory: regenerate the kinds, follow the renames, record the
// scale. Pure (no files), so the generator (scripts/scale-tokens.ts) and the lab's Scale preview share it.

export { scaleValues };

export type ScaleKind = GlobalScaleKind;
export const SCALE_KINDS: readonly ScaleKind[] = GLOBAL_SCALE_KINDS;
const UNIT: Partial<Record<ScaleKind, string>> = { duration: 'ms', distance: 'px', delay: 'ms' };
const TYPE: Partial<Record<ScaleKind, DerivedToken['$type']>> = { duration: 'duration', distance: 'dimension', delay: 'duration' };

export type Json = Record<string, unknown>;
export type TokenJson = { $type: string; $value: string | number; $description?: string; $extensions?: { status?: string; oldNames?: string[] } };


export const valueOf = (t: TokenJson): number => parseFloat(String(t.$value));

// Plain numbers (the old form: whole ms or px) as tokens of their kind.
function fromNumbers(kind: ScaleKind, values: number[]): DerivedToken[] {
  const unit = UNIT[kind];
  const type = TYPE[kind];
  if (unit === undefined || type === undefined) throw new Error(`${kind} tokens need names and values, not plain numbers`);
  return values.map(v => ({ name: String(v), $type: type, $value: `${v}${unit}` }));
}

// The kind regenerated from `derived` (tokens, or plain numbers for distance, duration and delay).
// `renames` maps each old path to its new one.
export function scaleKind(tokens: Json, kind: ScaleKind, derived: number[] | DerivedToken[]): { tokens: Json; renames: Record<string, string> } {
  const next = typeof derived[0] === 'number' ? fromNumbers(kind, derived as number[]) : (derived as DerivedToken[]);
  const group = (tokens[kind] ?? {}) as Record<string, TokenJson>;
  const old = Object.entries(group).sort(([, a], [, b]) => valueOf(a) - valueOf(b));
  if (old.length === 0) throw new Error(`There is no "${kind}" group in the token file`);
  const rank = (s?: string): number => (s === 'system' ? 1 : 0);

  const out: Record<string, TokenJson> = {};
  const renames: Record<string, string> = {};
  next.forEach((d, i) => {
    const name = d.name;
    const same = old[i];
    // The old steps that fold into this one: just step i, or all the leftovers into the last step.
    const folded = i === next.length - 1 ? old.slice(i) : same ? [same] : [];
    const status = folded.length
      ? folded.reduce((best, [, t]) => (rank(t.$extensions?.status) > rank(best) ? (t.$extensions?.status as string) : best), 'experimental')
      : 'experimental';
    const oldNames = [...new Set([...(same?.[1].$extensions?.oldNames ?? []), ...folded.map(([n]) => n).filter(n => n !== name)])];
    const token: TokenJson = { $type: d.$type, $value: d.$value };
    if (same?.[1].$description) token.$description = same[1].$description;
    token.$extensions = { status, ...(oldNames.length ? { oldNames } : {}) };
    out[name] = token;
    folded.forEach(([n]) => { renames[`${kind}.${n}`] = `${kind}.${name}`; });
  });
  return { tokens: { ...tokens, [kind]: out }, renames };
}

// ── The recorded scale ─────────────────────────────────────────────────────

// What a kind was generated from: the scale and the options that were not the defaults'.
export interface KindScale extends KindOptions { scale: string }
export type ScaleConfig = Partial<Record<ScaleKind, KindScale>>;

// The scales recorded in a token file, by kind. Empty for tokens nobody has generated: "Custom".
export function readScaleConfig(tokens: Json): ScaleConfig {
  const ext = tokens['$extensions'] as { scale?: { kinds?: ScaleConfig } } | undefined;
  return ext?.scale?.kinds ?? {};
}

// The token file with `entries` recorded as the scale of their kinds (others keep theirs).
export function withScaleConfig(tokens: Json, entries: ScaleConfig): Json {
  const ext = (tokens['$extensions'] ?? {}) as Json;
  const kinds = { ...readScaleConfig(tokens), ...entries };
  return { ...tokens, $extensions: { ...ext, scale: { kinds } } };
}

// Rewrite every whole-word reference to a renamed token, in one pass so a new name is never renamed again.
export function remapReferences(source: string, renames: Record<string, string>): string {
  const olds = Object.keys(renames).sort((a, b) => b.length - a.length);
  if (olds.length === 0) return source;
  const re = new RegExp(`(?<![\\w.-])(${olds.map(o => o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'g');
  return source.replace(re, m => renames[m]!);
}

// motion.json's layout: one token per line, so a regenerated file diffs cleanly.
export function formatTokenFile(tokens: Json): string {
  const inline = (v: unknown): string =>
    Array.isArray(v) ? `[${v.map(inline).join(', ')}]`
      : v !== null && typeof v === 'object' ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }`
        : JSON.stringify(v);
  // A group named by numbers is written smallest to largest. (JS lists whole-number keys first, so
  // "10" would otherwise come before "04".)
  const ordered = (obj: Json): [string, unknown][] => {
    const entries = Object.entries(obj);
    return entries.every(([k]) => /^\d+$/.test(k)) ? entries.sort(([a], [b]) => Number(a) - Number(b)) : entries;
  };
  const block = (obj: Json, pad: string): string =>
    ordered(obj).map(([k, v]) => {
      const isGroup = v !== null && typeof v === 'object' && !('$type' in v);
      return isGroup
        ? `${pad}${JSON.stringify(k)}: {\n${block(v as Json, pad + '  ')}\n${pad}}`
        : `${pad}${JSON.stringify(k)}: ${inline(v)}`;
    }).join(',\n');
  return `{\n${block(tokens, '  ')}\n}\n`;
}


export interface ScaleRun {
  tokens: Json;
  renames: Record<string, string>;
  /** Per kind: the new tokens, for the summary. */
  derived: Partial<Record<ScaleKind, DerivedToken[]>>;
}

// The whole change for a set of kinds, in memory: tokens regenerated, renames collected, scale
// recorded. Everything is derived before anything is applied, so a scale that doesn't fit one kind
// changes nothing.
export function applyScale(tokens: Json, kinds: ScaleKind[], scale: string, options: Partial<Record<ScaleKind, KindOptions>> = {}): ScaleRun {
  const derived: Partial<Record<ScaleKind, DerivedToken[]>> = {};
  for (const kind of kinds) derived[kind] = deriveKind(kind, scale, options[kind]);

  let next = tokens;
  const renames: Record<string, string> = {};
  const record: ScaleConfig = {};
  for (const kind of kinds) {
    const result = scaleKind(next, kind, derived[kind]!);
    next = result.tokens;
    Object.assign(renames, result.renames);
    record[kind] = { scale, ...(options[kind] ?? {}) };
  }
  return { tokens: withScaleConfig(next, record), renames, derived };
}


// ── Preview ────────────────────────────────────────────────────────────────
// What a scale would do to the tokens, without doing it: each current token next to the one that
// takes its place, and which versions use the tokens that would be renamed.

export interface PreviewToken { path: string; value: string }

export interface PreviewRow {
  kind: ScaleKind;
  /** The current token; null for a step the scale adds. */
  from: PreviewToken | null;
  /** The token that takes its place; null when the scale has fewer steps and this one folds into the last. */
  to: PreviewToken | null;
  /** The token's name changes (names are values). */
  renamed: boolean;
  /** The versions (as `component/version`) that use the current token. */
  usedBy: string[];
}

export interface ScalePreview {
  scale: string;
  rows: PreviewRow[];
  /** How many tokens change name. */
  renamed: number;
  /** The versions that use a renamed token: the ones whose files would change. */
  versions: string[];
  /** Why the scale doesn't fit, when it doesn't (two steps collide); the rows are empty then. */
  error?: string;
}

// A token's value as a designer reads it: 16px, 300ms, 56%, 95%.
export function displayValue(kind: ScaleKind, value: string | number): string {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : String(value);
}

// The recorded scale of each kind, or none ("Custom": the values were set by hand).
export function describeScaleConfig(tokens: Json): { custom: boolean; kinds: ScaleConfig } {
  const kinds = readScaleConfig(tokens);
  return { custom: Object.keys(kinds).length === 0, kinds };
}

export function previewScale(
  tokens: Json,
  scale: string,
  usedBy: (path: string) => string[] = () => [],
  kinds: readonly ScaleKind[] = SCALE_KINDS,
  options: Partial<Record<ScaleKind, KindOptions>> = {},
): ScalePreview {
  const rows: PreviewRow[] = [];
  try {
    for (const kind of kinds) {
      const derived = deriveKind(kind, scale, options[kind]);
      const old = Object.entries((tokens[kind] ?? {}) as Record<string, TokenJson>).sort(([, a], [, b]) => valueOf(a) - valueOf(b));
      for (let i = 0; i < Math.max(old.length, derived.length); i++) {
        const o = old[i];
        const d = derived[i];
        const from = o ? { path: `${kind}.${o[0]}`, value: displayValue(kind, o[1].$value) } : null;
        const to = d ? { path: `${kind}.${d.name}`, value: displayValue(kind, d.$value) } : null;
        // A step the scale drops folds into the last new step, so its references follow that one.
        const target = to ?? { path: `${kind}.${derived[derived.length - 1]!.name}`, value: '' };
        rows.push({ kind, from, to, renamed: !!from && from.path !== target.path, usedBy: from ? usedBy(from.path) : [] });
      }
    }
  } catch (e) {
    return { scale, rows: [], renamed: 0, versions: [], error: (e as Error).message };
  }
  const renamedRows = rows.filter(r => r.renamed);
  return { scale, rows, renamed: renamedRows.length, versions: [...new Set(renamedRows.flatMap(r => r.usedBy))].sort() };
}
