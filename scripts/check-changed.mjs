// npm run check:changed
//
// The quick check for while you work: typecheck, every unit test (a few seconds), and the browser tests only for what you changed:
// a component's own spec and the every-version test for that component, in Chromium. Lab, token or script changes are shared by
// everything, so they run a short smoke set of the lab's main screens (under 40 seconds), not the whole suite: this is a prototype tool, so run
// `npm run check:fast` once before pushing a lab change and `npm run check` before sending work for review.
//   npm run check:changed           what git says is changed (staged, unstaged and new files)
//   npm run check:changed -- card   named components, whatever git says
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args, env = {}) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } }).status === 0;
const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.split('\n').map(s => s.trim()).filter(Boolean);

const named = process.argv.slice(2).filter(a => a !== '--');
const changed = named.length
  ? named.map(n => `components/${n}/`)
  : [...new Set([...git(['diff', '--name-only', 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard'])])];

const components = new Set();
const pages = new Set();
let shared = false;
for (const file of changed) {
  const c = /^components\/([^/]+)\//.exec(file);
  const p = /^pages\/([^/]+)\//.exec(file);
  if (c) components.add(c[1]);
  else if (p) pages.add(p[1]);
  else if (/^(lab|tokens|scripts|playwright\.config|vite\.config|package\.json|tests\/(samples|e2e\/(lab|visual)))/.test(file)) shared = true;
}

if (!changed.length) { console.log('Nothing changed: nothing to check. (npm run check:changed -- <component> checks a component by name.)'); process.exit(0); }

console.log('check:changed → typecheck and unit tests, then the browser tests for ' + (shared ? 'the lab\'s main screens (a smoke set: the lab, tokens or scripts changed)' : [...components, ...pages].join(', ') || 'nothing in the browser'));
if (!run('npm', ['run', '--silent', 'typecheck']) || !run('npm', ['run', '--silent', 'test'])) process.exit(1);
// the screens everything else hangs off: the nav, the library, the pages library, the tokens and preview
const SMOKE = ['navigation', 'library-view', 'pages-library', 'tokens-view', 'preview-mode'];
if (shared) process.exit(run('npx', ['playwright', 'test', '--project=chromium', ...SMOKE.map(n => `tests/e2e/${n}.spec.ts`)]) ? 0 : 1);

const specs = [...components, ...pages].map(n => `tests/e2e/${n}.spec.ts`).filter(f => existsSync(join(root, f)));
let ok = true;
if (components.size) ok = run('npx', ['playwright', 'test', '--project=chromium', 'tests/e2e/all-versions.spec.ts', '-g', `^(${[...components].join('|')}):`]) && ok;
if (specs.length) ok = run('npx', ['playwright', 'test', '--project=chromium', ...specs]) && ok;
process.exit(ok ? 0 : 1);
