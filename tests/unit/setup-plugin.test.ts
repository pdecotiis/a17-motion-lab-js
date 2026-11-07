import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The setup skill lives in .claude/skills/ (a project skill) and is published as the motion-lab plugin (plugins/motion-lab/) so every
// designer's Claude has /motion-lab:setup before the project is on their machine. The plugin holds a copy; this keeps the two the same.
const root = process.cwd();
const skillBody = (file: string): string => readFileSync(join(root, file), 'utf8').replace(/^---[\s\S]*?---\n/, '');

describe('the setup skill and its plugin', () => {
  const project = '.claude/skills/motion-lab-setup/SKILL.md';
  const plugin = 'plugins/motion-lab/skills/setup/SKILL.md';
  it('exist', () => {
    expect(existsSync(join(root, project))).toBe(true);
    expect(existsSync(join(root, plugin))).toBe(true);
    expect(existsSync(join(root, 'plugins/motion-lab/.claude-plugin/plugin.json'))).toBe(true);
  });
  it('say the same thing (copy the skill into the plugin after changing it)', () => {
    expect(skillBody(plugin)).toBe(skillBody(project));
  });
  it('have a manifest with a name, a version and a description', () => {
    const m = JSON.parse(readFileSync(join(root, 'plugins/motion-lab/.claude-plugin/plugin.json'), 'utf8')) as Record<string, unknown>;
    expect(m['name']).toBe('motion-lab');
    expect(String(m['version'])).toMatch(/^\d+\.\d+\.\d+$/);
    expect(String(m['description']).length).toBeGreaterThan(20);
  });
  it('name the skill setup in the plugin, so the command is /motion-lab:setup', () => {
    expect(readFileSync(join(root, plugin), 'utf8')).toMatch(/^---\nname: setup\n/);
  });
});
