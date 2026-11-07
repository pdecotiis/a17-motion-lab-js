import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The starter permissions designers' Claude gets from the project (.claude/settings.json): what it may do without asking, and what it may
// never do. Designers work only through Claude, so the everyday commands run without a prompt each time, and the destructive ones are refused.
const read = <T>(file: string): T => JSON.parse(readFileSync(join(process.cwd(), file), 'utf8')) as T;
interface Settings { permissions: { defaultMode?: string; allow: string[]; deny: string[] } }

describe('.claude/settings.json (the designers\' starter permissions)', () => {
  const { permissions } = read<Settings>('.claude/settings.json');
  it('lets edits in the project through, and asks for anything not listed', () => {
    expect(permissions.defaultMode).toBe('acceptEdits');
  });
  it('allows the everyday work: the npm scripts, the tests, saving and sending work, reading Figma', () => {
    for (const rule of ['Bash(npm run *)', 'Bash(npm install)', 'Bash(npx playwright test *)', 'Bash(git add *)', 'Bash(git commit *)', 'Bash(git push *)', 'Bash(git switch *)', 'mcp__plugin_figma_figma__get_design_context']) {
      expect(permissions.allow, rule).toContain(rule);
    }
  });
  it('never allows installing arbitrary packages, or the Figma tools that write', () => {
    expect(permissions.allow).not.toContain('Bash(npm install *)');
    expect(permissions.allow.filter(r => /figma/.test(r) && /(use_figma|generate|create_new_file|send_code|upload|update_)/.test(r))).toEqual([]);
  });
  it('refuses the destructive ones: sudo, rm -rf, forced and deleting pushes, hard resets, discarding changes', () => {
    for (const rule of ['Bash(sudo *)', 'Bash(rm -rf *)', 'Bash(git push --force*)', 'Bash(git push -f*)', 'Bash(git reset --hard*)', 'Bash(git clean *)', 'Bash(git checkout -- *)', 'Bash(git restore *)', 'Bash(git branch -D *)']) {
      expect(permissions.deny, rule).toContain(rule);
    }
  });
  it('has no rule in both lists', () => {
    expect(permissions.allow.filter(r => permissions.deny.includes(r))).toEqual([]);
  });
});

describe('.claude/launch.json (the dev server the desktop app previews)', () => {
  const launch = read<{ configurations: { name: string; port: number; runtimeExecutable: string; runtimeArgs: string[] }[] }>('.claude/launch.json');
  it('starts the lab with the Node the project asks for (nvm, then npm run dev)', () => {
    const dev = launch.configurations.find(c => c.name === 'dev')!;
    expect(dev.port).toBe(5173);
    expect(dev.runtimeArgs.join(' ')).toMatch(/nvm use/);
    expect(dev.runtimeArgs.join(' ')).toMatch(/npm run dev/);
  });
  it('opens the lab at motionlab.localhost, the same port: a .localhost name needs no setup and no admin password', () => {
    const dev = launch.configurations.find(c => c.name === 'dev') as { url?: string; port: number };
    expect(dev.url).toBe(`http://motionlab.localhost:${dev.port}`);
  });
});
