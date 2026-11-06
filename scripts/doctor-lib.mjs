// The checks behind `npm run doctor`: is this computer ready to run the lab, and if not, what to do about it, in plain words.
//
// Plain ES modules, no dependencies and nothing newer than Node 14 can read, on purpose: this is the code that has to run on
// the old Node it is there to catch. (Vite on Node 16 fails with "does not provide an export named 'constants'", which says
// nothing about the real cause. This says it.)

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir, platform as osPlatform } from 'os';
import { execFileSync } from 'child_process';

/** "v22.14.0" or "22.12" as [major, minor, patch], or null. */
export function parseVersion(text) {
  const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(String(text));
  return m ? [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)] : null;
}

/** Is version `have` at least `want` (both [major, minor, patch])? */
export function atLeast(have, want) {
  for (let i = 0; i < 3; i++) {
    if (have[i] !== want[i]) return have[i] > want[i];
  }
  return true;
}

/** The Node this repo needs: the version in package.json "engines" (">=22.12"), else .nvmrc, else Node 22. */
export function requiredNode(root) {
  try {
    const engines = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).engines;
    const v = engines && engines.node && parseVersion(engines.node);
    if (v) return v;
  } catch (e) { /* fall through */ }
  try {
    const v = parseVersion(readFileSync(join(root, '.nvmrc'), 'utf8'));
    if (v) return v;
  } catch (e) { /* fall through */ }
  return [22, 0, 0];
}

const show = v => (v[2] ? `${v[0]}.${v[1]}.${v[2]}` : `${v[0]}.${v[1]}`);

/** How to get a newer Node, for whatever this computer has. */
export function nodeFix({ home = homedir(), env = process.env, platform = osPlatform() } = {}) {
  const hasNvm = Boolean(env.NVM_DIR) || existsSync(join(home, '.nvm', 'nvm.sh'));
  if (hasNvm) return 'In Terminal, in this folder: nvm install && nvm use   (the folder\'s .nvmrc says which Node), then try again.';
  if (platform === 'darwin') {
    return 'Install Node with nvm (https://github.com/nvm-sh/nvm#installing-and-updating), open a new Terminal window, then run: nvm install && nvm use   (or ask Claude to do it with you).';
  }
  return 'Install Node 22 with nvm (https://github.com/nvm-sh/nvm) or from https://nodejs.org, open a new terminal, then try again.';
}

/** Where Playwright keeps the browsers it downloads. */
export function playwrightCache({ home = homedir(), env = process.env, platform = osPlatform() } = {}) {
  if (env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== '0') return env.PLAYWRIGHT_BROWSERS_PATH;
  if (platform === 'darwin') return join(home, 'Library', 'Caches', 'ms-playwright');
  if (platform === 'win32') return join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'ms-playwright');
  return join(home, '.cache', 'ms-playwright');
}

/** The font files tokens/fonts.css asks for that are not there (it points into /fonts, which is not in git). */
export function missingFonts(root) {
  const css = join(root, 'tokens', 'fonts.css');
  if (!existsSync(css)) return [];
  const names = [];
  const re = /url\(["']?\.\.\/fonts\/([^"')]+)["']?\)/g;
  const text = readFileSync(css, 'utf8');
  let m;
  while ((m = re.exec(text))) names.push(m[1]);
  return [...new Set(names)].filter(f => !existsSync(join(root, 'fonts', f)));
}

function gitVersion() {
  try { return execFileSync('git', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return null; }
}
function gitConfig(root, key) {
  try { return execFileSync('git', ['config', '--get', key], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; }
}

/**
 * Every check, as { id, status: 'ok' | 'warn' | 'fail' | 'info', title, fix? }.
 *   mode "quick"  Node and installed packages only: what stops the lab starting at all (runs before `npm run dev`).
 *   mode "check"  adds what `npm run check` needs (Playwright browsers), as failures.
 *   mode "full"   everything, with the things only some work needs as warnings.
 * `ctx` is for tests: { nodeVersion, home, env, platform, git: () => string | null }.
 */
export function runChecks(root, mode = 'full', ctx = {}) {
  const nodeVersion = ctx.nodeVersion || process.version;
  const env = ctx.env || process.env;
  const home = ctx.home || homedir();
  const platform = ctx.platform || osPlatform();
  const git = ctx.git || gitVersion;
  const results = [];
  const add = (id, status, title, fix) => results.push(fix ? { id, status, title, fix } : { id, status, title });

  // Node: the one that stops everything, with a message that says why.
  const need = requiredNode(root);
  const have = parseVersion(nodeVersion);
  if (have && atLeast(have, need)) add('node', 'ok', `Node ${nodeVersion.replace(/^v/, '')}`);
  else add('node', 'fail', `This lab needs Node ${show(need)} or newer; this computer is running ${String(nodeVersion).replace(/^v/, '')}.`, nodeFix({ home, env, platform }));

  const installed = existsSync(join(root, 'node_modules', 'vite', 'package.json'));
  if (installed) add('packages', 'ok', 'Packages are installed');
  else add('packages', 'fail', 'The lab\'s packages are not installed yet.', 'In Terminal, in this folder: npm install   (it needs a network connection and takes a minute).');

  if (mode === 'quick') return results;

  if (mode === 'check' || mode === 'full') {
    const cache = playwrightCache({ home, env, platform });
    const has = prefix => existsSync(cache) && readdirSync(cache).some(d => d.startsWith(prefix));
    const browsers = has('chromium') && has('webkit');
    const fix = 'In Terminal, in this folder: npx playwright install chromium webkit   (a download of a few hundred MB, once per computer).';
    if (browsers) add('browsers', 'ok', 'Test browsers are installed');
    else add('browsers', mode === 'check' ? 'fail' : 'warn', 'The test browsers are not installed. `npm run check` (the last step before sending work for review) needs them.', fix);
  }
  if (mode === 'check') return results;

  const gv = git();
  if (gv) add('git', 'ok', gv.replace(/^git version /, 'Git '));
  else add('git', 'fail', 'Git is not installed or not working.', 'In Terminal run: git --version   (on a Mac it offers to install Apple\'s command line tools: accept, and wait for it to finish).');

  if (gv && existsSync(join(root, '.git'))) {
    if (gitConfig(root, 'merge.project-owned.driver') === 'true') add('merge-driver', 'ok', 'Token files are protected from template merges');
    else add('merge-driver', 'warn', 'A merge from the template could overwrite this project\'s token files (the setting that protects them is missing).', 'In Terminal, in this folder: npm install   (or: node scripts/setup-git.mjs).');
  }

  const fonts = missingFonts(root);
  if (fonts.length === 0) add('fonts', 'ok', 'Client fonts are in place (or none are needed)');
  else add('fonts', 'warn', `Client font files are missing (${fonts.join(', ')}). The lab still works, but shows a fallback typeface instead of the client\'s.`, 'Ask whoever holds the client\'s fonts for these files and put them in the fonts folder of this project (it is not in git).');

  const isProject = !existsSync(join(root, 'components', 'card', 'motion.ts'));
  if (isProject && !existsSync(join(root, 'project.json'))) {
    add('project-name', 'warn', 'This project has no name yet, so the header just says "Motion Lab".', 'Add a project.json at the top of the folder: { "name": "Client name" }   (restart the lab after adding it).');
  }

  add('figma', 'info', 'Importing from Figma needs the Figma connector in Claude Code, signed in with access to the client\'s file. This script cannot check that: ask Claude to.');
  return results;
}

/** The results as text for a person: a tick or a cross for each, and what to do under anything that is not fine. */
export function formatResults(results, { quiet = false } = {}) {
  const marks = { ok: '✓', warn: '!', fail: '✗', info: 'i' };
  const shown = quiet ? results.filter(r => r.status === 'fail') : results;
  if (shown.length === 0) return '';
  const lines = [];
  if (quiet) lines.push('The lab can\'t start yet:', '');
  else lines.push('Motion Lab: is this computer ready?', '');
  for (const r of shown) {
    lines.push(` ${marks[r.status]} ${r.title}`);
    if (r.fix && r.status !== 'ok') lines.push(`     To fix: ${r.fix}`);
  }
  if (quiet) lines.push('', 'Run `npm run doctor` for the full list. Claude can walk you through any of this.');
  return lines.join('\n');
}
