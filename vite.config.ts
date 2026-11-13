import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { scaleApplyPlugin } from './scripts/scale-plugin';
import { pageVersionPlugin } from './scripts/page-version-plugin';
import { teamPlugin } from './scripts/team-plugin';
import { versionArchivePlugin } from './scripts/version-archive-plugin';
import { archivePlugin } from './scripts/archive-plugin';

// The computer's git user, for the avatar in the header (dev server only: a built copy has no one to show).
function gitUser(): string {
  try { return execSync('git config user.name', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
}

// A GitHub login for the avatar picture, if the computer says who it is: "git config github.user", a GitHub no-reply
// commit email ("12345+maya@users.noreply.github.com"), or the GitHub CLI when it is installed and signed in. A
// computer that names none (or a project on another git host) just shows initials.
function githubLogin(): string {
  const run = (cmd: string): string => { try { return execSync(cmd, { encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
  const set = run('git config github.user');
  if (set) return set;
  const noreply = /^(?:\d+\+)?([^@+]+)@users\.noreply\.github\.com$/.exec(run('git config user.email'));
  if (noreply) return noreply[1]!;
  return run('gh api user --jq .login');
}

export default defineConfig(({ command }) => ({
  define: {
    __LAB_USER__: JSON.stringify(command === 'serve' ? gitUser() : ''),
    __LAB_GITHUB__: JSON.stringify(command === 'serve' ? githubLogin() : ''),
  },
  root: 'lab',
  base: './',
  plugins: [scaleApplyPlugin(__dirname), pageVersionPlugin(__dirname), teamPlugin(__dirname), versionArchivePlugin(__dirname), archivePlugin(__dirname)],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@tokens': resolve(__dirname, 'tokens'),
      '@components': resolve(__dirname, 'components'),
      '@lib': resolve(__dirname, 'lab/lib'),
    },
  },
}));
