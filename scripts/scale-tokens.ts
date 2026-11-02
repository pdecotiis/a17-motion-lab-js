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
import { dirname, resolve } from 'node:path';
import { runScale } from './scale-run.js';
import { SCALE_KINDS, applyScale, formatTokenFile, remapReferences, readScaleConfig, scaleKind, scaleValues, withScaleConfig, type ScaleKind } from '../lab/lib/scale-apply.js';
import type { KindOptions } from '../lab/lib/scales.js';

// The pure parts live in lab/lib/scale-apply.ts (the lab's Scale preview shares them); re-exported for the tests.
export { SCALE_KINDS, applyScale, formatTokenFile, remapReferences, readScaleConfig, scaleKind, scaleValues, withScaleConfig };
export type { ScaleKind };

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
  const dry = flags.has('dry-run');
  const run = runScale({ root, kinds, scale, options, dryRun: dry });
  const changed = run.versionFiles.length;

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
