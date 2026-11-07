// Who has worked in this project, for the avatars beside the theme switch. It is read from the project's own git history
// (no service, nothing to sign in to): everyone who has made a commit, however long ago. Pure: scripts/team-plugin.ts
// runs `git log` and serves the result at /__lab/team, lab/main.ts draws it.

export interface Person {
  name: string;
  email: string;
  commits: number;
  /** Unix seconds of their latest commit; 0 for someone with none yet (the person using the lab, before their first save). */
  lastActive: number;
  /** Their GitHub login, when it is known (a no-reply commit email names it, or project.json maps their name to it). */
  login?: string;
}

/** The format `git log` is asked for: name, email and commit time, separated by the unit separator. */
export const TEAM_LOG_FORMAT = '%aN%x1f%aE%x1f%ct';

const NOREPLY = /^(?:\d+\+)?([A-Za-z0-9-]{1,39})@users\.noreply\.github\.com$/i;
const LOGIN = /^[A-Za-z0-9-]{1,39}$/;

/** Accounts that are not people: GitHub's web editor and apps, CI and dependency bots. */
export function isBot(name: string, email: string): boolean {
  return /\[bot\]/i.test(name) || /\[bot\]/i.test(email)
    || /^(github|web-flow|github-actions|dependabot|renovate)$/i.test(name)
    || /^noreply@github\.com$/i.test(email) || /^(?:\d+\+)?[^@]*\[bot\]@/i.test(email);
}

/**
 * Turn the output of `git log --format=<TEAM_LOG_FORMAT>` into people, most recent first. The same email is one person
 * (and so is the same name under two emails); bots are left out. `logins` maps a name to a GitHub login for people who
 * commit with a private email.
 */
export function parseTeamLog(raw: string, logins: Record<string, string> = {}): Person[] {
  const byKey = new Map<string, Person>();
  for (const line of raw.split('\n')) {
    const [name = '', email = '', time = ''] = line.trim().split('\x1f');
    const when = Number(time);
    if (!name.trim() || !/^\d+$/.test(time.trim()) || !Number.isFinite(when) || isBot(name, email)) continue;
    const key = name.trim().toLowerCase();
    const known = byKey.get(key) ?? [...byKey.values()].find(p => email && p.email.toLowerCase() === email.toLowerCase());
    const login = NOREPLY.exec(email)?.[1];
    if (known) {
      known.commits += 1;
      if (when > known.lastActive) known.lastActive = when;
      if (!known.login && login) known.login = login;
    } else {
      const person: Person = { name: name.trim(), email: email.trim(), commits: 1, lastActive: when };
      if (login) person.login = login;
      byKey.set(key, person);
    }
  }
  const mapped = Object.fromEntries(Object.entries(logins).map(([n, l]) => [n.trim().toLowerCase(), l]));
  const people = [...byKey.values()];
  for (const p of people) {
    const fromMap = mapped[p.name.toLowerCase()];
    if (fromMap && LOGIN.test(fromMap)) p.login = fromMap;
  }
  return people.sort((a, b) => b.lastActive - a.lastActive || a.name.localeCompare(b.name));
}

export interface Arranged { shown: Person[]; more: number }

/**
 * The avatars to show: the person using the lab first, then the others by how recently they worked, at most `max` in
 * all and a count for the rest. With nobody else there is nothing to show (`shown` is empty), so a one-person project
 * keeps its single avatar.
 */
export function arrangeTeam(people: Person[], you: { name?: string; email?: string }, max = 4): Arranged {
  const isYou = (p: Person): boolean =>
    (!!you.email && p.email.toLowerCase() === you.email.toLowerCase()) || (!!you.name && p.name.toLowerCase() === you.name.toLowerCase());
  const me = people.find(isYou) ?? (you.name ? { name: you.name, email: you.email ?? '', commits: 0, lastActive: 0 } : undefined);
  const others = people.filter(p => !isYou(p));
  if (others.length === 0) return { shown: [], more: 0 };
  const all = me ? [me, ...others] : others;
  return { shown: all.slice(0, max), more: Math.max(all.length - max, 0) };
}

/** "today", "yesterday", "3 days ago", "2 weeks ago", "5 months ago"; '' for someone with no commits. */
export function lastWorked(unixSeconds: number, nowMs: number): string {
  if (!unixSeconds) return '';
  const days = Math.max(Math.floor((nowMs / 1000 - unixSeconds) / 86400), 0);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/** What an avatar's tooltip says: the name, and when they last worked in the project. */
export function personTitle(p: Person, nowMs: number): string {
  const when = lastWorked(p.lastActive, nowMs);
  return when ? `${p.name} · last worked ${when}` : p.name;
}
