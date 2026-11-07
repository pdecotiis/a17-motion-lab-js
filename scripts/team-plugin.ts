/**
 * The dev server's /__lab/team endpoint: who has worked in this project, for the avatars in the header.
 *   GET → { people: Person[], you: { name, email } }   (the project's git history; `you` is this computer's git user)
 *
 * Dev server only, never part of `npm run build` (a built copy has no endpoint and the lab shows just you). Read-only:
 * it runs `git log` and `git config`, nothing else, and refuses a request that comes from another site's page. The
 * answer is kept for a minute so a busy lab does not run git on every view.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { parseTeamLog, TEAM_LOG_FORMAT, type Person } from '../lab/lib/team.js';
import { teamLoginsOf } from '../lab/lib/project.js';

export const TEAM_ENDPOINT = '/__lab/team';
const CACHE_MS = 60_000;

export interface TeamRequest { method: string; origin?: string | undefined; host?: string | undefined }
export interface TeamResponse { status: number; body: unknown }
export type Git = (args: string[]) => string;

/** Runs git in the project; a failure (no git, not a checkout) is an empty answer, never an error. */
export function gitIn(root: string): Git {
  return args => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; }
  };
}

function readLogins(root: string): Record<string, string> {
  try {
    const file = join(root, 'project.json');
    return existsSync(file) ? teamLoginsOf(JSON.parse(readFileSync(file, 'utf8'))) : {};
  } catch { return {}; }
}

export function handleTeamRequest(root: string, req: TeamRequest, git: Git = gitIn(root)): TeamResponse {
  if (req.origin && req.host) {
    let originHost = '';
    try { originHost = new URL(req.origin).host; } catch { /* a bad Origin is refused below */ }
    if (originHost !== req.host) return { status: 403, body: { error: 'Refused: this request did not come from the lab.' } };
  }
  if (req.method !== 'GET') return { status: 405, body: { error: 'Use GET.' } };
  const people: Person[] = parseTeamLog(git(['log', '--no-merges', `--format=${TEAM_LOG_FORMAT}`]), readLogins(root));
  return { status: 200, body: { people, you: { name: git(['config', 'user.name']).trim(), email: git(['config', 'user.email']).trim() } } };
}

export function teamPlugin(root: string): Plugin {
  let cached: { at: number; out: TeamResponse } | undefined;
  return {
    name: 'motion-lab-team',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(TEAM_ENDPOINT, (req, res) => {
        const now = Date.now();
        if (!cached || now - cached.at > CACHE_MS) {
          cached = { at: now, out: handleTeamRequest(root, { method: req.method ?? 'GET', origin: req.headers.origin, host: req.headers.host }) };
        }
        res.statusCode = cached.out.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(cached.out.body));
      });
    },
  };
}
