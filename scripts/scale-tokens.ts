/**
 * Usage:
 *   npm run tokens:scale -- <kind> <scale> [--base N] [--steps N] [--up N] [--snap N] [--dry-run]
 *   npm run tokens:scale -- --all <scale> [--snap N] [--dry-run]
 *
 *   kind    distance | duration | delay | opacity | scale
 *   scale   minor-third | major-third | perfect-fourth | golden-ratio | fibonacci, or a ratio above 1 (1.4)
 *   --all   apply the scale to every kind, with each kind's own base and number of steps
 *
 * Regenerates the kind(s) in tokens/motion.json from the scale (the maths is lab/lib/scales.ts), then
 * follows the renames through the version files so nothing dangles. Tokens are named by value, so a
 * new scale means new names. Step i takes over from the old step i: it keeps that token's status
 * and notes and records the old name in `oldNames`. Extra steps start experimental; if there are
 * fewer steps, the old steps left over fold into the last one, which keeps the highest status.
 *
 * The scale used for each kind is recorded in motion.json under `$extensions.scale`, so the lab can
 * say which scale the tokens follow. --dry-run shows what would change and writes nothing; --root <dir>
 * works on another checkout. Review `git diff` afterwards: pairing rules and keyframes may want a
 * second look.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { scaleValues, deriveKind, GLOBAL_SCALE_KINDS, type DerivedToken, type GlobalScaleKind, type KindOptions } from '../lab/lib/scales.js';

export type ScaleKind = GlobalScaleKind;
export const SCALE_KINDS: readonly ScaleKind[] = GLOBAL_SCALE_KINDS;
const UNIT: Partial<Record<ScaleKind, string>> = { duration: 'ms', distance: 'px', delay: 'ms' };
const TYPE: Partial<Record<ScaleKind, DerivedToken['$type']>> = { duration: 'duration', distance: 'dimension', delay: 'duration' };

type Json = Record<string, unknown>;
type TokenJson = { $type: string; $value: string | number; $description?: string; $extensions?: { status?: string; oldNames?: string[] } };

// The maths lives in lab/lib/scales.ts (shared with the global scale); re-exported for the generator's tests.
export { scaleValues };

const valueOf = (t: TokenJson): number => parseFloat(String(t.$value));

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

// ── The command ────────────────────────────────────────────────────────────

const USAGE = `Usage: npm run tokens:scale -- <${SCALE_KINDS.join('|')}> <scale> [--base N] [--steps N] [--up N] [--snap N] [--dry-run]
       npm run tokens:scale -- --all <scale> [--snap N] [--dry-run]`;

export interface ParsedArgs { positional: string[]; flags: Map<string, string | true> }

export function parseArgs(argv: string[]): ParsedArgs {
  const booleans = new Set(['all', 'dry-run']);
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  const args = argv.filter(a => a !== '--');
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const name = a.slice(2);
    if (booleans.has(name)) {
      flags.set(name, true);
    } else {
      const value = args[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`--${name} needs a value\n${USAGE}`);
      flags.set(name, value);
    }
  }
  return { positional, flags };
}

// A numeric flag, or undefined when absent.
function numberFlag(flags: Map<string, string | true>, name: string, min = 1): number | undefined {
  const v = flags.get(name);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new Error(`--${name} must be a number of at least ${min}`);
  return n;
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

function main(): void {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const all = flags.has('all');
  const [first, second] = positional;
  const kinds: ScaleKind[] = all ? [...SCALE_KINDS] : [first as ScaleKind];
  const scale = all ? first : second;
  if (!scale || (!all && !SCALE_KINDS.includes(first as ScaleKind))) {
    console.error(USAGE);
    process.exit(1);
  }

  const snap = numberFlag(flags, 'snap');
  const options: Partial<Record<ScaleKind, KindOptions>> = {};
  for (const kind of kinds) {
    const o: KindOptions = {};
    if (!all) {
      const base = numberFlag(flags, 'base');
      const steps = numberFlag(flags, 'steps');
      const up = numberFlag(flags, 'up', 0);
      if (base !== undefined) o.base = base;
      if (steps !== undefined) o.steps = steps;
      if (up !== undefined) o.up = up;
    }
    if (kind === 'distance' && snap) o.snap = snap;
    options[kind] = o;
  }

  const rootFlag = flags.get('root');
  const root = typeof rootFlag === 'string' ? resolve(rootFlag) : resolve(import.meta.dirname ?? dirname(new URL(import.meta.url).pathname), '..');
  const file = join(root, 'tokens/motion.json');
  const run = applyScale(JSON.parse(readFileSync(file, 'utf8')) as Json, kinds, scale, options);
  const dry = flags.has('dry-run');

  let changed = 0;
  const versionsDir = join(root, 'components');
  if (existsSync(versionsDir)) {
    for (const component of readdirSync(versionsDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
      const dir = join(versionsDir, component.name, 'versions');
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter(n => n.endsWith('.ts'))) {
        const path = join(dir, f);
        const before = readFileSync(path, 'utf8');
        const after = remapReferences(before, run.renames);
        if (after === before) continue;
        changed++;
        if (!dry) writeFileSync(path, after);
      }
    }
  }
  if (!dry) writeFileSync(file, formatTokenFile(run.tokens));

  for (const kind of kinds) console.log(`${kind} (${scale}): ${run.derived[kind]!.map(t => t.name).join(', ')}`);
  for (const [from, to] of Object.entries(run.renames)) if (from !== to) console.log(`  ${from} → ${to}`);
  console.log(dry
    ? `Dry run: tokens/motion.json and ${changed} version file${changed === 1 ? '' : 's'} would change. Nothing was written.`
    : `Updated tokens/motion.json and ${changed} version file${changed === 1 ? '' : 's'}.`);
}

// Importing this file (the tests do) must not run the command.
if (!process.env['VITEST']) {
  try {
    main();
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
