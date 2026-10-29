/**
 * Usage: npm run figma:import -- <manifest.json>
 *
 * Manifest (paths are relative to the manifest file):
 * {
 *   "name": "hero-banner", "layerName": "hero banner",
 *   "figmaUrl": "https://www.figma.com/design/…?node-id=1-2",
 *   "markup": "markup.html", "styles": "styles.css",
 *   "assets": { "image.png": "image.png" },
 *   "variables": { "space/3": "12" },
 *   "frame": { "width": 941, "height": 767 }, "designWidth": 1136,
 *   "issues": ["…"]
 * }
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { importComponent, validateImportedComponent, type ImportInput } from './lib.js';

const manifestPath = process.argv.slice(2).find(a => a !== '--');
if (!manifestPath) {
  console.error('Usage: npm run figma:import -- <manifest.json>');
  process.exit(1);
}

const base = dirname(resolve(manifestPath));
const m = JSON.parse(readFileSync(manifestPath, 'utf8')) as Omit<ImportInput, 'markup' | 'styles'> & {
  markup: string;
  styles: string;
};

const input: ImportInput = {
  ...m,
  markup: readFileSync(resolve(base, m.markup), 'utf8'),
  styles: readFileSync(resolve(base, m.styles), 'utf8'),
  assets: Object.fromEntries(Object.entries(m.assets ?? {}).map(([k, v]) => [k, resolve(base, v)])),
};

const root = resolve(import.meta.dirname ?? dirname(new URL(import.meta.url).pathname), '../..');
const result = importComponent(root, input);
const errors = validateImportedComponent(root, input.name);

console.log(`Imported components/${input.name}/`);
console.log(result.scaffoldedVersion ? '  scaffolded versions/v1.ts (first import)' : '  version files left untouched (re-import)');
if (result.fontFallbacks.length) console.log(`  font fallbacks (not in /fonts): ${result.fontFallbacks.join(', ')}`);
if (errors.length) {
  console.error('  validation errors:\n    ' + errors.join('\n    '));
  process.exit(1);
}
