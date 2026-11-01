/**
 * Usage: npm run spec -- <component> [version] [--out <dir>]
 *
 * Writes the developer hand-off for a component's versions to <out>/<component>/<version>/:
 *   motion.css   stack-neutral @keyframes + class, token custom properties, reduced-motion block
 *   tokens.css   the CSS custom properties that version uses
 *   spec.md      when it plays, what animates, timing, reduced motion, what the lab doesn't cover
 *
 * With no version, exports every approved version. With a version id, exports that one
 * whatever its status (spec.md says when it isn't approved).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { compileTokens } from '../lab/lib/token-compiler.js';
import { buildVersionExport } from '../lab/lib/spec.js';
import { getVersionStatus } from '../lab/lib/version-meta.js';
import type { ComponentModule, DtcgGroup } from '../lab/lib/types.js';

const positional: string[] = [];
let outArg: string | undefined;
const args = process.argv.slice(2).filter(a => a !== '--');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') {
    outArg = args[++i];
    if (!outArg) {
      console.error('--out needs a directory');
      process.exit(1);
    }
  } else {
    positional.push(args[i]!);
  }
}
const [component, versionId] = positional;
if (!component) {
  console.error('Usage: npm run spec -- <component> [version] [--out <dir>]');
  process.exit(1);
}

const root = resolve(import.meta.dirname ?? dirname(new URL(import.meta.url).pathname), '..');
const outRoot = resolve(root, outArg ?? 'export');

const mod = (await import(resolve(root, 'components', component, 'motion.ts'))) as { default: ComponentModule };
const versions = mod.default.versions;
const tokens = compileTokens(JSON.parse(readFileSync(resolve(root, 'tokens/motion.json'), 'utf8')) as DtcgGroup);

const chosen = versionId
  ? versions.filter(v => v.id === versionId)
  : versions.filter(v => getVersionStatus(v) === 'approved');

if (chosen.length === 0) {
  console.error(
    versionId
      ? `"${component}" has no version "${versionId}" (it has ${versions.map(v => v.id).join(', ')})`
      : `"${component}" has no approved versions. Pass a version id to export one anyway.`,
  );
  process.exit(1);
}

for (const v of chosen) {
  const dir = join(outRoot, component, v.id);
  mkdirSync(dir, { recursive: true });
  const { css, tokensCss, markdown } = buildVersionExport(component, v, versions, tokens);
  writeFileSync(join(dir, 'motion.css'), css);
  writeFileSync(join(dir, 'tokens.css'), tokensCss);
  writeFileSync(join(dir, 'spec.md'), markdown);
  console.log(`${component} ${v.id} (${getVersionStatus(v)}) → ${dir}`);
}
