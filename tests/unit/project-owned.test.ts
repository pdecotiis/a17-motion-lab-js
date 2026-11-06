import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SAMPLES_PRESENT } from '../samples.js';

// A project repo owns its token files. A merge from the template must never overwrite them, so .gitattributes
// gives them the "project-owned" merge driver (keep ours) and `npm install` switches the driver on
// (scripts/setup-git.mjs). This holds in the template too: the attributes ship from here.

const OWNED = ['tokens/motion.json', 'tokens/presets.json', 'tokens/figma-variables.json', 'tokens/visual.css', 'tokens/fonts.css'];
const root = process.cwd();

describe('project-owned token files', () => {
  const attributes = readFileSync(join(root, '.gitattributes'), 'utf8');

  it.each(OWNED)('.gitattributes gives %s the project-owned merge driver', file => {
    expect(attributes).toMatch(new RegExp(`^${file.replace(/\./g, '\\.')}\\s+merge=project-owned\\s*$`, 'm'));
  });

  it('package.json sets the driver after every install', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(pkg.scripts['postinstall']).toBe('node scripts/setup-git.mjs');
    expect(existsSync(join(root, 'scripts/setup-git.mjs'))).toBe(true);
  });

  // In a project repo (the samples are gone) the driver must be there, or a template merge would overwrite the tokens.
  it.skipIf(SAMPLES_PRESENT || !existsSync(join(root, '.git')))('the merge driver is configured in this project repo', () => {
    const value = (() => {
      try { return execFileSync('git', ['config', '--get', 'merge.project-owned.driver'], { encoding: 'utf8' }).trim(); } catch { return ''; }
    })();
    expect(value, 'run `npm install` (or `node scripts/setup-git.mjs`) so a merge from the template keeps this project\'s tokens').toBe('true');
  });
});

// The real thing, on throwaway repos: a project that changed a token file, and a template that changed the same
// lines, merge with no conflict and the project keeps its own file. Without the driver the same merge conflicts.
describe('a merge from the template (throwaway repos)', () => {
  const git = (cwd: string, ...args: string[]): string =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

  function setup(withDriver: boolean): { project: string; template: string } {
    const dir = mkdtempSync(join(tmpdir(), 'owned-'));
    const template = join(dir, 'template');
    const project = join(dir, 'project');
    mkdirSync(join(template, 'tokens'), { recursive: true });
    writeFileSync(join(template, '.gitattributes'), readFileSync(join(root, '.gitattributes')));
    writeFileSync(join(template, 'tokens/motion.json'), '{\n  "duration": "250ms"\n}\n');
    writeFileSync(join(template, 'lab.txt'), 'v1\n');
    git(template, 'init', '-q', '-b', 'main');
    git(template, 'add', '-A');
    git(template, 'commit', '-q', '-m', 'start');
    git(dir, 'clone', '-q', template, project);
    if (withDriver) git(project, 'config', 'merge.project-owned.driver', 'true');
    // The project tweaks its tokens; the template changes the same line and also improves the lab.
    writeFileSync(join(project, 'tokens/motion.json'), '{\n  "duration": "300ms"\n}\n');
    git(project, 'commit', '-q', '-am', 'project tokens');
    writeFileSync(join(template, 'tokens/motion.json'), '{\n  "duration": "200ms"\n}\n');
    writeFileSync(join(template, 'lab.txt'), 'v2\n');
    git(template, 'commit', '-q', '-am', 'template tokens and lab');
    return { project, template };
  }

  it('keeps the project\'s tokens and still takes the template\'s other changes', () => {
    const { project } = setup(true);
    git(project, 'pull', '-q', '--no-rebase', '--no-edit', 'origin', 'main');
    expect(readFileSync(join(project, 'tokens/motion.json'), 'utf8')).toContain('300ms');
    expect(readFileSync(join(project, 'lab.txt'), 'utf8')).toBe('v2\n');
  });

  it('conflicts without the driver, which is why npm install sets it', () => {
    const { project } = setup(false);
    expect(() => git(project, 'pull', '-q', '--no-rebase', '--no-edit', 'origin', 'main')).toThrow();
  });
});
