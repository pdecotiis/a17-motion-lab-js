// Sets the one git setting this repo needs: the "project-owned" merge driver that .gitattributes names for the
// token files. The driver is `true`: on a merge conflict in one of those files, keep this repo's own version.
// Runs after `npm install` / `npm ci` (package.json "postinstall"), so every clone has it; plain Node, no
// dependencies, and it never fails an install (not a git checkout, no git: it just does nothing).
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

try {
  if (existsSync('.git')) {
    execFileSync('git', ['config', 'merge.project-owned.driver', 'true'], { stdio: 'ignore' });
    execFileSync('git', ['config', 'merge.project-owned.name', "keep this project's own file"], { stdio: 'ignore' });
  }
} catch {
  // Not fatal: tests/unit/project-owned.test.ts says so when a project repo is missing the setting.
}
