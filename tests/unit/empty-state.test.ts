import { describe, it, expect } from 'vitest';
import { EMPTY_STATES } from '../../lab/lib/empty-state.js';

// What an empty lab tells a designer: plain words, things to ask Claude, nothing to do with git or code.
describe('the empty lab', () => {
  for (const [kind, state] of Object.entries(EMPTY_STATES)) {
    describe(kind, () => {
      it('has a title, a line saying what to do, three requests to copy and a tip', () => {
        expect(state.title.length).toBeGreaterThan(3);
        expect(state.lead).toMatch(/Claude/);
        expect(state.prompts).toHaveLength(3);
        expect(state.tip.length).toBeGreaterThan(10);
      });
      it('asks Claude in plain words: no git or code jargon', () => {
        const all = [state.title, state.lead, state.tip, ...state.prompts.flatMap(p => [p.label, p.text])].join(' ');
        expect(all).not.toMatch(/\b(git|commit|branch|merge|push|pull|npm|terminal|json|typescript)\b/i);
      });
      it('has three different jobs, each with a label, and requests that end like a sentence or a prompt to fill in', () => {
        expect(new Set(state.prompts.map(p => p.label)).size).toBe(3);
        expect(new Set(state.prompts.map(p => p.text)).size).toBe(3);
        for (const p of state.prompts) { expect(p.label.length).toBeGreaterThan(3); expect(p.text).toMatch(/[.)]$/); }
      });
      it('never repeats a request in other words: only one asks for a frame, selected or by link, per job', () => {
        const importing = state.prompts.filter(p => /selected/.test(p.text));
        expect(importing.length).toBeLessThanOrEqual(2);
        for (const p of importing) expect(p.text).toMatch(/or this link/);
      });
    });
  }
  it('has an empty state for the components and for the pages', () => {
    expect(Object.keys(EMPTY_STATES).sort()).toEqual(['components', 'pages']);
  });
});
