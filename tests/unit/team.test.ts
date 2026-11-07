import { describe, it, expect } from 'vitest';
import { parseTeamLog, arrangeTeam, lastWorked, personTitle, isBot, TEAM_LOG_FORMAT } from '../../lab/lib/team.js';
import { handleTeamRequest } from '../../scripts/team-plugin.js';
import { teamLoginsOf } from '../../lab/lib/project.js';

const line = (name: string, email: string, t: number): string => `${name}\x1f${email}\x1f${t}`;
const DAY = 86400;

describe('the team, from the project\'s history', () => {
  it('asks git for name, email and time', () => {
    expect(TEAM_LOG_FORMAT).toBe('%aN%x1f%aE%x1f%ct');
  });

  it('makes one person of one email, counts their commits and keeps their latest time', () => {
    const people = parseTeamLog([line('Maya Chen', 'maya@x.com', 100), line('Maya Chen', 'maya@x.com', 300), line('Maya Chen', 'maya@x.com', 200)].join('\n'));
    expect(people).toEqual([{ name: 'Maya Chen', email: 'maya@x.com', commits: 3, lastActive: 300 }]);
  });

  it('treats the same name under two emails as one person', () => {
    const people = parseTeamLog([line('Miguel R', 'a@x.com', 10), line('miguel r', 'b@y.com', 20)].join('\n'));
    expect(people).toHaveLength(1);
    expect(people[0]!.commits).toBe(2);
  });

  it('leaves out bots and the web editor', () => {
    const raw = [line('dependabot[bot]', '1+dependabot[bot]@users.noreply.github.com', 5), line('GitHub', 'noreply@github.com', 6), line('github-actions', 'actions@x.com', 7), line('Claudia', 'c@x.com', 8)].join('\n');
    expect(parseTeamLog(raw).map(p => p.name)).toEqual(['Claudia']);
    expect(isBot('Maya', 'maya@x.com')).toBe(false);
  });

  it('reads a GitHub login from a no-reply email, and from project.json for a private one', () => {
    const raw = [line('Maya', '123+mayachen@users.noreply.github.com', 2), line('Claudia Reyes', 'private@x.com', 1)].join('\n');
    const people = parseTeamLog(raw, { 'Claudia Reyes': 'claudiar', 'Nobody': 'x y' });
    expect(people.find(p => p.name === 'Maya')!.login).toBe('mayachen');
    expect(people.find(p => p.name === 'Claudia Reyes')!.login).toBe('claudiar');
  });

  it('puts the most recent first', () => {
    const people = parseTeamLog([line('Old', 'o@x.com', 1), line('New', 'n@x.com', 9)].join('\n'));
    expect(people.map(p => p.name)).toEqual(['New', 'Old']);
  });

  it('ignores blank and broken lines', () => {
    expect(parseTeamLog('\n\nnot a line\n')).toEqual([]);
  });
});

describe('who is shown', () => {
  const people = parseTeamLog(['A One', 'B Two', 'C Three', 'D Four', 'E Five', 'F Six'].map((n, i) => line(n, `${n[0]!.toLowerCase()}@x.com`, 100 - i)).join('\n'));

  it('shows nothing when nobody else has worked here', () => {
    expect(arrangeTeam(people.slice(0, 1), { email: 'a@x.com' })).toEqual({ shown: [], more: 0 });
    expect(arrangeTeam([], { name: 'Maya', email: 'm@x.com' })).toEqual({ shown: [], more: 0 });
  });

  it('puts you first, then the others, with a count for the rest', () => {
    const out = arrangeTeam(people, { email: 'c@x.com', name: 'C Three' }, 4);
    expect(out.shown.map(p => p.name)).toEqual(['C Three', 'A One', 'B Two', 'D Four']);
    expect(out.more).toBe(2);
  });

  it('shows you even before your first commit', () => {
    const out = arrangeTeam(people.slice(0, 2), { name: 'New Designer', email: 'new@x.com' });
    expect(out.shown.map(p => p.name)).toEqual(['New Designer', 'A One', 'B Two']);
    expect(out.shown[0]!.commits).toBe(0);
  });
});

describe('when someone last worked', () => {
  const now = 1_000_000 * 1000;
  it('says it in days, weeks and months', () => {
    expect(lastWorked(now / 1000 - 100, now)).toBe('today');
    expect(lastWorked(now / 1000 - DAY * 1.5, now)).toBe('yesterday');
    expect(lastWorked(now / 1000 - DAY * 5, now)).toBe('5 days ago');
    expect(lastWorked(now / 1000 - DAY * 21, now)).toBe('3 weeks ago');
    expect(lastWorked(now / 1000 - DAY * 90, now)).toBe('3 months ago');
    expect(lastWorked(0, now)).toBe('');
  });
  it('puts it in the tooltip', () => {
    expect(personTitle({ name: 'Maya', email: '', commits: 1, lastActive: now / 1000 - DAY * 5 }, now)).toBe('Maya · last worked 5 days ago');
    expect(personTitle({ name: 'Maya', email: '', commits: 0, lastActive: 0 }, now)).toBe('Maya');
  });
});

describe('the /__lab/team endpoint', () => {
  const git = (args: string[]): string => (args[0] === 'log' ? line('Maya', 'm@x.com', 5) : args[1] === 'user.name' ? 'Paul\n' : 'p@x.com\n');
  it('answers with the people and who is asking', () => {
    const out = handleTeamRequest('/nowhere', { method: 'GET', host: 'a:1', origin: 'http://a:1' }, git);
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ people: [{ name: 'Maya', email: 'm@x.com', commits: 1, lastActive: 5 }], you: { name: 'Paul', email: 'p@x.com' } });
  });
  it('refuses another site and any method but GET', () => {
    expect(handleTeamRequest('/nowhere', { method: 'GET', host: 'a:1', origin: 'http://evil.example' }, git).status).toBe(403);
    expect(handleTeamRequest('/nowhere', { method: 'POST', host: 'a:1' }, git).status).toBe(405);
  });
});

describe('project.json team names', () => {
  it('keeps only name to GitHub login pairs', () => {
    expect(teamLoginsOf({ team: { 'Claudia Reyes': 'claudiar', Bad: 'no spaces', Num: 5 } })).toEqual({ 'Claudia Reyes': 'claudiar' });
    expect(teamLoginsOf({ name: 'x' })).toEqual({});
    expect(teamLoginsOf(null)).toEqual({});
    expect(teamLoginsOf({ team: ['a'] })).toEqual({});
  });
});
