/**
 * Usage: npm run tokens:scale -- <duration|distance|delay> <fibonacci|ratio> [--base N] [--steps N]
 *
 * Regenerates one scale kind in tokens/motion.json from a scale, then follows the renames through
 * the version files so nothing dangles. Tokens are named by value, so a new scale means new names:
 *
 *   fibonacci   base × 1, 2, 3, 5, 8, 13, …            (npm run tokens:scale -- duration fibonacci)
 *   a ratio     base × ratio^0, ratio^1, ratio^2, …    (npm run tokens:scale -- distance 1.4)
 *
 * --base defaults to the kind's smallest value and --steps to its current number of steps. Values
 * are rounded to whole ms or px. Step i takes over from the old step i: it keeps that token's
 * status and notes and records the old name in `oldNames`. Extra steps start experimental; if
 * there are fewer steps, the old steps left over fold into the last one, which keeps the highest
 * status. Review `git diff` afterwards: pairing rules and keyframes may want a second look.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type ScaleKind = 'duration' | 'distance' | 'delay';
export const SCALE_KINDS: readonly ScaleKind[] = ['duration', 'distance', 'delay'];
const UNIT: Record<ScaleKind, string> = { duration: 'ms', distance: 'px', delay: 'ms' };
const TYPE: Record<ScaleKind, string> = { duration: 'duration', distance: 'dimension', delay: 'duration' };

type Json = Record<string, unknown>;
type TokenJson = { $type: string; $value: string; $description?: string; $extensions?: { status?: string; oldNames?: string[] } };

// base × the scale's multipliers, rounded; each step must be larger than the one before.
export function scaleValues(scale: 'fibonacci' | number, base: number, steps: number): number[] {
  if (!(base > 0) || !Number.isInteger(steps) || steps < 1) throw new Error('base must be above 0 and steps a whole number');
  if (scale !== 'fibonacci' && !(scale > 1)) throw new Error('A ratio must be above 1');
  const fib = [1, 2];
  while (fib.length < steps) fib.push(fib[fib.length - 1]! + fib[fib.length - 2]!);
  const values = Array.from({ length: steps }, (_, i) => Math.round(base * (scale === 'fibonacci' ? fib[i]! : scale ** i)));
  values.forEach((v, i) => {
    if (i > 0 && v <= values[i - 1]!) throw new Error(`Steps ${i} and ${i + 1} both round to ${v}: use a larger base or ratio`);
  });
  return values;
}

const valueOf = (t: TokenJson): number => parseFloat(t.$value);

// The kind regenerated from `values`. `renames` maps each old path to its new one.
export function scaleKind(tokens: Json, kind: ScaleKind, values: number[]): { tokens: Json; renames: Record<string, string> } {
  const group = (tokens[kind] ?? {}) as Record<string, TokenJson>;
  const old = Object.entries(group).sort(([, a], [, b]) => valueOf(a) - valueOf(b));
  if (old.length === 0) throw new Error(`There is no "${kind}" group in the token file`);
  const rank = (s?: string): number => (s === 'system' ? 1 : 0);

  const next: Record<string, TokenJson> = {};
  const renames: Record<string, string> = {};
  values.forEach((v, i) => {
    const name = String(v);
    const same = old[i];
    // The old steps that fold into this one: just step i, or all the leftovers into the last step.
    const folded = i === values.length - 1 ? old.slice(i) : same ? [same] : [];
    const status = folded.length
      ? folded.reduce((best, [, t]) => (rank(t.$extensions?.status) > rank(best) ? (t.$extensions?.status as string) : best), 'experimental')
      : 'experimental';
    const oldNames = [...new Set([...(same?.[1].$extensions?.oldNames ?? []), ...folded.map(([n]) => n).filter(n => n !== name)])];
    const token: TokenJson = { $type: TYPE[kind], $value: `${v}${UNIT[kind]}` };
    if (same?.[1].$description) token.$description = same[1].$description;
    token.$extensions = { status, ...(oldNames.length ? { oldNames } : {}) };
    next[name] = token;
    folded.forEach(([n]) => { renames[`${kind}.${n}`] = `${kind}.${name}`; });
  });
  return { tokens: { ...tokens, [kind]: next }, renames };
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

function main(): void {
  const args = process.argv.slice(2).filter(a => a !== '--');
  const positional = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  const flag = (name: string): number | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? Number(args[i + 1]) : undefined;
  };
  const [kind, scaleArg] = positional;
  if (!SCALE_KINDS.includes(kind as ScaleKind) || !scaleArg) {
    console.error('Usage: npm run tokens:scale -- <duration|distance|delay> <fibonacci|ratio> [--base N] [--steps N]');
    process.exit(1);
  }

  const root = resolve(import.meta.dirname ?? dirname(new URL(import.meta.url).pathname), '..');
  const file = join(root, 'tokens/motion.json');
  const tokens = JSON.parse(readFileSync(file, 'utf8')) as Json;
  const current = Object.values((tokens[kind!] ?? {}) as Record<string, TokenJson>).map(valueOf);

  const values = scaleValues(scaleArg === 'fibonacci' ? 'fibonacci' : Number(scaleArg), flag('base') ?? Math.min(...current), flag('steps') ?? current.length);
  const result = scaleKind(tokens, kind as ScaleKind, values);
  writeFileSync(file, formatTokenFile(result.tokens));

  let changed = 0;
  const versionsDir = join(root, 'components');
  for (const component of readdirSync(versionsDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
    const dir = join(versionsDir, component.name, 'versions');
    for (const f of readdirSync(dir).filter(n => n.endsWith('.ts'))) {
      const path = join(dir, f);
      const before = readFileSync(path, 'utf8');
      const after = remapReferences(before, result.renames);
      if (after !== before) { writeFileSync(path, after); changed++; }
    }
  }

  console.log(`${kind}: ${values.join(', ')}`);
  for (const [from, to] of Object.entries(result.renames)) if (from !== to) console.log(`  ${from} → ${to}`);
  console.log(`Updated tokens/motion.json and ${changed} version file${changed === 1 ? '' : 's'}.`);
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
