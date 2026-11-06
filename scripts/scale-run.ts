/**
 * Applies a scale to a checkout on disk: the one place that writes tokens/motion.json and the version
 * files. The command line (scripts/scale-tokens.ts) and the lab's Apply button (the dev server's
 * /__lab/scale, scripts/scale-plugin.ts) both call it, so they do exactly the same thing.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyScale, formatTokenFile, remapReferences, type Json, type ScaleKind } from '../lab/lib/scale-apply.js';
import type { DerivedToken, KindOptions } from '../lab/lib/scales.js';

export interface ScaleRunResult {
  scale: string;
  kinds: ScaleKind[];
  /** The new tokens of each kind. */
  derived: Partial<Record<ScaleKind, DerivedToken[]>>;
  /** Old token path → new token path (including those that kept their name). */
  renames: Record<string, string>;
  /** The version files (relative to the root) that use a renamed token. */
  versionFiles: string[];
  dryRun: boolean;
}

export interface ScaleRunOptions {
  root: string;
  kinds: ScaleKind[];
  scale: string;
  options?: Partial<Record<ScaleKind, KindOptions>>;
  /** Work out the change and report it, but write nothing. */
  dryRun?: boolean;
}

/**
 * The files in a project that name a renamed token, rewritten: every version file, and the presets table
 * (tokens/presets.json, which names tokens too), and the page versions (their stagger is a delay token). Pure of writing: it returns the edits.
 */
export function projectEdits(root: string, renames: Record<string, string>): { path: string; relative: string; text: string }[] {
  const edits: { path: string; relative: string; text: string }[] = [];
  const componentsDir = join(root, 'components');
  if (existsSync(componentsDir)) {
    for (const component of readdirSync(componentsDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
      const dir = join(componentsDir, component.name, 'versions');
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter(n => n.endsWith('.ts'))) {
        const path = join(dir, f);
        const before = readFileSync(path, 'utf8');
        const after = remapReferences(before, renames);
        if (after !== before) edits.push({ path, relative: `components/${component.name}/versions/${f}`, text: after });
      }
    }
  }
  // A page version names a delay token as its stagger.
  const pagesDir = join(root, 'pages');
  if (existsSync(pagesDir)) {
    for (const page of readdirSync(pagesDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
      const dir = join(pagesDir, page.name, 'versions');
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter(n => n.endsWith('.json'))) {
        const path = join(dir, f);
        const before = readFileSync(path, 'utf8');
        const after = remapReferences(before, renames);
        if (after !== before) edits.push({ path, relative: `pages/${page.name}/versions/${f}`, text: after });
      }
    }
  }
  const presets = join(root, 'tokens/presets.json');
  if (existsSync(presets)) {
    const before = readFileSync(presets, 'utf8');
    const after = remapReferences(before, renames);
    if (after !== before) edits.push({ path: presets, relative: 'tokens/presets.json', text: after });
  }
  return edits;
}

// Everything is worked out before anything is written, so a scale that doesn't fit changes nothing.
export function runScale({ root, kinds, scale, options = {}, dryRun = false }: ScaleRunOptions): ScaleRunResult {
  const tokensFile = join(root, 'tokens/motion.json');
  const run = applyScale(JSON.parse(readFileSync(tokensFile, 'utf8')) as Json, kinds, scale, options);

  const edits = projectEdits(root, run.renames);

  if (!dryRun) {
    for (const e of edits) writeFileSync(e.path, e.text);
    writeFileSync(tokensFile, formatTokenFile(run.tokens));
  }
  return { scale, kinds, derived: run.derived, renames: run.renames, versionFiles: edits.map(e => e.relative), dryRun };
}
