/**
 * Usage: npm run figma:import-page -- <manifest.json>
 *
 * Run after each section has been imported as a component (npm run figma:import).
 * Manifest:
 * {
 *   "id": "about", "title": "About",
 *   "figmaUrl": "https://www.figma.com/design/…?node-id=1-2",
 *   "frame": { "width": 1440, "height": 5136 },
 *   "width": 1136,
 *   "sections": [
 *     { "component": "page-header", "figmaName": "page header" },
 *     { "component": "section-header", "figmaName": "section header" },
 *     { "component": "section-header", "figmaName": "section header" }
 *   ],
 *   "notImported": [{ "name": "menu", "reason": "off-canvas menu, not part of the page flow" }],
 *   "issues": ["…"]
 * }
 * A component used twice becomes two slots (section-header-1, section-header-2).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { importPage, validateImportedPage, type PageImportInput } from './page.js';

const manifestPath = process.argv.slice(2).find(a => a !== '--');
if (!manifestPath) {
  console.error('Usage: npm run figma:import-page -- <manifest.json>');
  process.exit(1);
}

const input = JSON.parse(readFileSync(resolve(manifestPath), 'utf8')) as PageImportInput;
const root = resolve(import.meta.dirname ?? dirname(new URL(import.meta.url).pathname), '../..');

let result;
try {
  result = importPage(root, input);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
const errors = validateImportedPage(root, input.id);

console.log(`Imported pages/${input.id}/ with ${result.slots.length} components: ${result.slots.join(', ')}`);
console.log(result.scaffoldedVersion ? '  saved page version v1 (every component on its default version)' : '  page versions left untouched (re-import)');
if (result.staleVersions.length) console.log(`  these saved page versions no longer fit:\n    ${result.staleVersions.join('\n    ')}`);
if (errors.length) {
  console.error('  validation errors:\n    ' + errors.join('\n    '));
  process.exit(1);
}
