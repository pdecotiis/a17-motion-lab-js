import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { atLeast, formatResults, missingFonts, nodeFix, parseVersion, playwrightCache, requiredNode, runChecks } from '../../scripts/doctor-lib.mjs';

// `npm run doctor`: whether this computer is ready to run the lab, in plain words. It has to run on an old Node (the
// failure it exists to explain), so it is plain JavaScript with no dependencies; these tests pin what it says.

const repo = resolve(import.meta.dirname, '../..');
const made: string[] = [];
function project(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'doctor-'));
  made.push(dir);
  const all: Record<string, string> = { 'package.json': JSON.stringify({ engines: { node: '>=22.12' } }), 'node_modules/vite/package.json': '{}', ...files };
  for (const [path, text] of Object.entries(all)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
afterAll(() => made.forEach(d => rmSync(d, { recursive: true, force: true })));

const noGit = { git: () => null };
const ok = (v: string) => ({ nodeVersion: v, git: () => 'git version 2.40.0' });

describe('versions', () => {
  it('reads a version however it is written', () => {
    expect(parseVersion('v22.14.0')).toEqual([22, 14, 0]);
    expect(parseVersion('22.12')).toEqual([22, 12, 0]);
    expect(parseVersion('22')).toEqual([22, 0, 0]);
    expect(parseVersion('>=22.12')).toEqual([22, 12, 0]);
    expect(parseVersion('nonsense')).toBeNull();
  });
  it('compares major, then minor, then patch', () => {
    expect(atLeast([22, 14, 0], [22, 12, 0])).toBe(true);
    expect(atLeast([22, 12, 0], [22, 12, 0])).toBe(true);
    expect(atLeast([22, 11, 9], [22, 12, 0])).toBe(false);
    expect(atLeast([16, 16, 0], [22, 12, 0])).toBe(false);
    expect(atLeast([24, 0, 0], [22, 12, 0])).toBe(true);
  });
  it('wants the Node in package.json engines, else .nvmrc, else 22', () => {
    expect(requiredNode(project())).toEqual([22, 12, 0]);
    expect(requiredNode(project({ 'package.json': '{}', '.nvmrc': '20\n' }))).toEqual([20, 0, 0]);
    expect(requiredNode(project({ 'package.json': '{}' }))).toEqual([22, 0, 0]);
  });
});

describe('Node', () => {
  it('passes on a new enough Node', () => {
    const r = runChecks(project(), 'quick', ok('v22.14.0'));
    expect(r.find(x => x.id === 'node')).toMatchObject({ status: 'ok' });
  });
  it('fails on an old one, says which it wants and which it found, in plain words', () => {
    const node = runChecks(project(), 'quick', ok('v16.16.0')).find(x => x.id === 'node')!;
    expect(node.status).toBe('fail');
    expect(node.title).toBe('This lab needs Node 22.12 or newer; this computer is running 16.16.0.');
    expect(node.fix).toBeTruthy();
  });
  it('fails on 22.11, which is 22 but too old', () => {
    expect(runChecks(project(), 'quick', ok('v22.11.0')).find(x => x.id === 'node')!.status).toBe('fail');
  });
  it('suggests nvm when it is there, and how to get it when it is not', () => {
    const withNvm = project({ '.nvm/nvm.sh': '' });
    expect(nodeFix({ home: withNvm, env: {}, platform: 'darwin' })).toContain('nvm install && nvm use');
    expect(nodeFix({ home: project(), env: {}, platform: 'darwin' })).toContain('https://github.com/nvm-sh/nvm');
    expect(nodeFix({ home: project(), env: { NVM_DIR: '/x' }, platform: 'darwin' })).toContain('nvm install && nvm use');
  });
});

describe('packages', () => {
  it('fail when the packages are not installed, and say to npm install', () => {
    const dir = project();
    rmSync(join(dir, 'node_modules'), { recursive: true });
    const r = runChecks(dir, 'quick', ok('v22.14.0')).find(x => x.id === 'packages')!;
    expect(r.status).toBe('fail');
    expect(r.fix).toContain('npm install');
  });
});

describe('modes', () => {
  it('quick checks only what stops the lab starting: Node and packages', () => {
    expect(runChecks(project(), 'quick', ok('v22.14.0')).map(r => r.id)).toEqual(['node', 'packages']);
  });
  it('check adds the test browsers, as a failure when they are missing', () => {
    const home = project();
    const r = runChecks(project(), 'check', { ...ok('v22.14.0'), home, env: {}, platform: 'darwin' });
    expect(r.map(x => x.id)).toEqual(['node', 'packages', 'browsers']);
    expect(r.find(x => x.id === 'browsers')).toMatchObject({ status: 'fail' });
  });
  it('full reports the same browsers as a warning, since only sending work for review needs them', () => {
    const r = runChecks(project(), 'full', { ...ok('v22.14.0'), home: project(), env: {}, platform: 'darwin' });
    expect(r.find(x => x.id === 'browsers')).toMatchObject({ status: 'warn' });
  });
});

describe('Playwright browsers', () => {
  it('are found in the cache folder, by name', () => {
    const home = project({ 'Library/Caches/ms-playwright/chromium-1208/x': '', 'Library/Caches/ms-playwright/webkit-2370/x': '' });
    const r = runChecks(project(), 'check', { ...ok('v22.14.0'), home, env: {}, platform: 'darwin' });
    expect(r.find(x => x.id === 'browsers')).toMatchObject({ status: 'ok' });
  });
  it('need both Chromium and WebKit', () => {
    const home = project({ 'Library/Caches/ms-playwright/chromium-1208/x': '' });
    const r = runChecks(project(), 'check', { ...ok('v22.14.0'), home, env: {}, platform: 'darwin' });
    expect(r.find(x => x.id === 'browsers')).toMatchObject({ status: 'fail' });
  });
  it('follow PLAYWRIGHT_BROWSERS_PATH, and the OS default otherwise', () => {
    expect(playwrightCache({ home: '/h', env: { PLAYWRIGHT_BROWSERS_PATH: '/custom' }, platform: 'darwin' })).toBe('/custom');
    expect(playwrightCache({ home: '/h', env: {}, platform: 'darwin' })).toBe(join('/h', 'Library', 'Caches', 'ms-playwright'));
    expect(playwrightCache({ home: '/h', env: {}, platform: 'linux' })).toBe(join('/h', '.cache', 'ms-playwright'));
  });
});

describe('client fonts', () => {
  const css = '@font-face {\n  font-family: "Acme";\n  src: url("../fonts/Acme-Regular.otf");\n}\n@font-face {\n  src: url("../fonts/Acme-Bold.woff2");\n}\n';
  it('lists the font files tokens/fonts.css asks for that are not in /fonts', () => {
    expect(missingFonts(project({ 'tokens/fonts.css': css }))).toEqual(['Acme-Regular.otf', 'Acme-Bold.woff2']);
    expect(missingFonts(project({ 'tokens/fonts.css': css, 'fonts/Acme-Regular.otf': '' }))).toEqual(['Acme-Bold.woff2']);
  });
  it('are fine when there is none to ask for', () => {
    expect(missingFonts(project())).toEqual([]);
    expect(missingFonts(project({ 'tokens/fonts.css': '/* header only */\n' }))).toEqual([]);
  });
  it('warn (the lab still works) and name the files', () => {
    const r = runChecks(project({ 'tokens/fonts.css': css }), 'full', { ...ok('v22.14.0'), env: {}, home: project() }).find(x => x.id === 'fonts')!;
    expect(r.status).toBe('warn');
    expect(r.title).toContain('Acme-Regular.otf');
    expect(r.title).toContain('fallback typeface');
  });
});

describe('the rest of the full check', () => {
  it('fails when git is missing and says how a Mac gets it', () => {
    const r = runChecks(project(), 'full', { ...noGit, nodeVersion: 'v22.14.0', env: {}, home: project() }).find(x => x.id === 'git')!;
    expect(r.status).toBe('fail');
    expect(r.fix).toContain('git --version');
  });
  it('says a project with no project.json has no name for the header, but not the template', () => {
    const asProject = runChecks(project(), 'full', { ...ok('v22.14.0'), env: {}, home: project() });
    expect(asProject.find(x => x.id === 'project-name')).toMatchObject({ status: 'warn' });
    const asTemplate = runChecks(project({ 'components/card/motion.ts': '' }), 'full', { ...ok('v22.14.0'), env: {}, home: project() });
    expect(asTemplate.find(x => x.id === 'project-name')).toBeUndefined();
  });
  it('always reminds about the Figma connector, which it cannot check itself', () => {
    const r = runChecks(project(), 'full', { ...ok('v22.14.0'), env: {}, home: project() }).find(x => x.id === 'figma')!;
    expect(r.status).toBe('info');
    expect(r.title).toContain('Figma connector');
  });
});

describe('what a person reads', () => {
  it('quiet output shows only the failures, under a heading, with what to do', () => {
    const text = formatResults(runChecks(project(), 'quick', ok('v16.16.0')), { quiet: true });
    expect(text).toContain('The lab can\'t start yet:');
    expect(text).toContain('✗ This lab needs Node 22.12 or newer');
    expect(text).toContain('To fix:');
    expect(text).not.toContain('✓');
  });
  it('quiet output is empty when nothing is wrong', () => {
    expect(formatResults(runChecks(project(), 'quick', ok('v22.14.0')), { quiet: true })).toBe('');
  });
  it('the full list shows every check with a mark, and a fix only under what is not fine', () => {
    const text = formatResults(runChecks(project(), 'full', { ...ok('v22.14.0'), env: {}, home: project() }));
    expect(text).toContain('✓ Node 22.14.0');
    expect(text).toContain('! This project has no name yet');
  });
});

describe('the repo itself', () => {
  it('declares the Node it needs, and npm refuses to install on an older one', () => {
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')) as { engines: { node: string }; scripts: Record<string, string> };
    expect(pkg.engines.node).toBe('>=22.12');
    expect(readFileSync(join(repo, '.npmrc'), 'utf8')).toContain('engine-strict=true');
  });
  it('runs the quick doctor before the lab starts and the check doctor before the check', () => {
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['predev']).toBe('node scripts/doctor.mjs --quick');
    expect(pkg.scripts['precheck']).toBe('node scripts/doctor.mjs --for check');
    expect(pkg.scripts['doctor']).toBe('node scripts/doctor.mjs');
  });
  it('is ready on the Node this test runs on: the quick doctor exits 0 and says nothing', () => {
    const run = spawnSync(process.execPath, ['scripts/doctor.mjs', '--quick'], { cwd: repo, encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('');
  });
  it('--json says whether it is ready and lists the checks', () => {
    const run = spawnSync(process.execPath, ['scripts/doctor.mjs', '--json'], { cwd: repo, encoding: 'utf8' });
    const out = JSON.parse(run.stdout) as { ready: boolean; mode: string; results: { id: string }[] };
    expect(out.mode).toBe('full');
    expect(out.results.map(r => r.id)).toEqual(expect.arrayContaining(['node', 'packages', 'git', 'figma']));
  });
  it('uses no syntax an old Node cannot read, so it can explain the problem on it (checked on the source text)', () => {
    for (const file of ['scripts/doctor-lib.mjs', 'scripts/doctor.mjs']) {
      const text = readFileSync(join(repo, file), 'utf8');
      expect(text, file).not.toMatch(/\?\?=|\|\|=|&&=|\.at\(|structuredClone|from 'node:/);
    }
  });
});
