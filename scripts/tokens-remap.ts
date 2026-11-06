/**
 * Usage:
 *   npm run tokens:remap -- <spec.json> [--dry-run] [--root <dir>]
 *   npm run tokens:remap -- --renames <renames.json> [--dry-run] [--root <dir>]
 *
 * Replaces the base tokens of some kinds with a set of your own choosing (see lab/lib/token-remap.ts for the spec),
 * sending each old token to the new token with the closest value, then follows the renames through the version files
 * and tokens/presets.json so nothing dangles. Writes the renames next to the spec (<spec>.renames.json).
 *
 * The second form applies a renames file to a project whose tokens/motion.json already has the new tokens (a project
 * repo that merged the template): it rewrites the version files and presets that still name the old ones, and touches
 * nothing else. --dry-run reports and writes nothing; --root works on another checkout.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { applyRemap, type RemapSpec } from '../lab/lib/token-remap.js';
import { formatTokenFile, type Json } from '../lab/lib/scale-apply.js';
import { projectEdits } from './scale-run.js';

export interface RemapRun {
  renames: Record<string, string>;
  files: string[];
  dryRun: boolean;
}

/** Applies a spec to a checkout on disk: tokens, version files and presets. Returns the renames. */
export function runRemap(root: string, spec: RemapSpec, dryRun = false): RemapRun & { names: Record<string, string[] | undefined> } {
  const tokensFile = join(root, 'tokens/motion.json');
  const remap = applyRemap(JSON.parse(readFileSync(tokensFile, 'utf8')) as Json, spec);
  const edits = projectEdits(root, remap.renames);
  if (!dryRun) {
    for (const e of edits) writeFileSync(e.path, e.text);
    writeFileSync(tokensFile, formatTokenFile(remap.tokens));
  }
  return { renames: remap.renames, files: edits.map(e => e.relative), names: remap.names, dryRun };
}

/** Applies renames to a checkout whose tokens already have the new names: only the files that name the old ones. */
export function runRenames(root: string, renames: Record<string, string>, dryRun = false): RemapRun {
  const edits = projectEdits(root, renames);
  if (!dryRun) for (const e of edits) writeFileSync(e.path, e.text);
  return { renames, files: edits.map(e => e.relative), dryRun };
}

function main(): void {
  const args = process.argv.slice(2).filter(a => a !== '--');
  const flag = (name: string): string | undefined => { const i = args.indexOf(`--${name}`); return i === -1 ? undefined : args[i + 1]; };
  const dry = args.includes('--dry-run');
  const root = resolve(flag('root') ?? join(import.meta.dirname ?? dirname(new URL(import.meta.url).pathname), '..'));
  const renamesFile = flag('renames');
  const spec = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--root' && args[i - 1] !== '--renames');

  if (renamesFile) {
    const run = runRenames(root, JSON.parse(readFileSync(resolve(renamesFile), 'utf8')) as Record<string, string>, dry);
    console.log(`${dry ? 'Dry run: ' : ''}${run.files.length} file${run.files.length === 1 ? '' : 's'} ${dry ? 'would change' : 'updated'}: ${run.files.join(', ') || 'none'}`);
    return;
  }
  if (!spec) { console.error('Usage: npm run tokens:remap -- <spec.json> [--dry-run] [--root <dir>]\n       npm run tokens:remap -- --renames <renames.json> [--dry-run] [--root <dir>]'); process.exit(1); }
  const specPath = resolve(spec);
  const run = runRemap(root, JSON.parse(readFileSync(specPath, 'utf8')) as RemapSpec, dry);
  for (const [kind, names] of Object.entries(run.names)) console.log(`${kind}: ${(names ?? []).join(', ')}`);
  for (const [from, to] of Object.entries(run.renames)) if (from !== to) console.log(`  ${from} → ${to}`);
  if (!dry) {
    const out = join(dirname(specPath), `${basename(specPath, '.json')}.renames.json`);
    writeFileSync(out, `${JSON.stringify(Object.fromEntries(Object.entries(run.renames).filter(([f, t]) => f !== t)), null, 2)}\n`);
    console.log(`Renames written to ${out}`);
  }
  console.log(dry
    ? `Dry run: tokens/motion.json and ${run.files.length} other file${run.files.length === 1 ? '' : 's'} would change. Nothing was written.`
    : `Updated tokens/motion.json and ${run.files.length} other file${run.files.length === 1 ? '' : 's'}: ${run.files.join(', ')}`);
}

if (!process.env['VITEST'] && existsSync(process.argv[1] ?? '')) {
  try { main(); } catch (e) { console.error((e as Error).message); process.exit(1); }
}
