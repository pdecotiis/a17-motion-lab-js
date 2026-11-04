/**
 * Usage: npm run spec -- <component> [version] [--out <dir>] [--format css|gsap|motion|all] [--bounce <N>]
 *
 * Writes the developer hand-off for a component's versions to <out>/<component>/<version>/:
 *   motion.css   stack-neutral @keyframes + class, token custom properties, reduced-motion block
 *   motion.gsap.js    the same motion for GSAP (easing only), with --format gsap or all
 *   motion.motion.js  the same motion for Motion (springs), with --format motion or all
 *                     --bounce N picks the global bounce token for motions that name none (default 25)
 *   tokens.css   the CSS custom properties that version uses
 *   spec.md      when it plays, what animates, timing, reduced motion, what the lab doesn't cover
 *
 * With no version, exports the component's latest version when the component is approved.
 * With a version id, exports that one whatever the component's status (spec.md says when it isn't approved).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { compileTokens } from '../lab/lib/token-compiler.js';
import { buildVersionExport } from '../lab/lib/spec.js';
import { buildExportCode, buildPresetsGsap, buildPresetsMotion, EXPORT_FILES, EXPORT_FORMATS, PRESET_FILES, type ExportFormat } from '../lab/lib/export-code.js';
import { buildPresetsCss, presetsUsed } from '../lab/lib/css-output.js';
import { stepsOf } from '../lab/lib/motion-models.js';
import { DEFAULT_BOUNCE } from '../lab/lib/motion-args.js';
import { getComponentStatus } from '../lab/lib/version-meta.js';
import type { ComponentModule, DtcgGroup } from '../lab/lib/types.js';

const positional: string[] = [];
let outArg: string | undefined;
let formatArg = 'css';
let bounceArg: string | undefined;
const args = process.argv.slice(2).filter(a => a !== '--');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') {
    outArg = args[++i];
    if (!outArg) {
      console.error('--out needs a directory');
      process.exit(1);
    }
  } else if (args[i] === '--format') {
    formatArg = args[++i] ?? '';
  } else if (args[i] === '--bounce') {
    bounceArg = args[++i];
  } else {
    positional.push(args[i]!);
  }
}
const [component, versionId] = positional;
if (!component) {
  console.error('Usage: npm run spec -- <component> [version] [--out <dir>] [--format css|gsap|motion|all] [--bounce <N>]');
  process.exit(1);
}
if (formatArg !== 'all' && !EXPORT_FORMATS.includes(formatArg as ExportFormat)) {
  console.error(`--format must be one of ${EXPORT_FORMATS.join(', ')} or all, not "${formatArg}"`);
  process.exit(1);
}

const root = resolve(import.meta.dirname ?? dirname(new URL(import.meta.url).pathname), '..');
const outRoot = resolve(root, outArg ?? 'export');

const mod = (await import(resolve(root, 'components', component, 'motion.ts'))) as { default: ComponentModule };
const versions = mod.default.versions;
const componentStatus = getComponentStatus(mod.default);
const tokens = compileTokens(JSON.parse(readFileSync(resolve(root, 'tokens/motion.json'), 'utf8')) as DtcgGroup);

const globalBounce = bounceArg === undefined ? DEFAULT_BOUNCE : `bounce.${bounceArg}`;
if (!(globalBounce in tokens.raw)) {
  console.error(`--bounce ${bounceArg} is not a bounce token (try ${Object.keys(tokens.raw).filter(k => k.startsWith('bounce.')).map(k => k.slice('bounce.'.length)).join(', ')})`);
  process.exit(1);
}

const chosen = versionId
  ? versions.filter(v => v.id === versionId)
  : componentStatus === 'approved' ? versions.slice(-1) : [];

if (chosen.length === 0) {
  console.error(
    versionId
      ? `"${component}" has no version "${versionId}" (it has ${versions.map(v => v.id).join(', ')})`
      : `"${component}" is not approved (it is ${componentStatus}). Pass a version id to export one anyway.`,
  );
  process.exit(1);
}

for (const v of chosen) {
  const dir = join(outRoot, component, v.id);
  mkdirSync(dir, { recursive: true });
  const { css, tokensCss, markdown } = buildVersionExport(component, v, versions, tokens, componentStatus);
  // motion.css is always written; GSAP and Motion code on request.
  writeFileSync(join(dir, EXPORT_FILES.css), css);
  const extra = (formatArg === 'all' ? EXPORT_FORMATS : [formatArg as ExportFormat]).filter(f => f !== 'css');
  for (const f of extra) writeFileSync(join(dir, EXPORT_FILES[f]), buildExportCode(f, v, tokens.raw, { component, globalBounce, css }));
  // A version that uses entrance presets gets the shared definitions next to it, one file per format.
  if (presetsUsed(stepsOf(v)).length) {
    writeFileSync(join(dir, PRESET_FILES.css), buildPresetsCss(tokens.raw));
    if (extra.includes('gsap')) writeFileSync(join(dir, PRESET_FILES.gsap), buildPresetsGsap(tokens.raw));
    if (extra.includes('motion')) writeFileSync(join(dir, PRESET_FILES.motion), buildPresetsMotion(tokens.raw, globalBounce));
  }
  writeFileSync(join(dir, 'tokens.css'), tokensCss);
  writeFileSync(join(dir, 'spec.md'), markdown);
  console.log(`${component} ${v.id} (${componentStatus}) → ${dir}`);
}
