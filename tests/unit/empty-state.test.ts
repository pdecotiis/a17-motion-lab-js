import { describe, it, expect } from 'vitest';
import { EMPTY_STATES } from '../../lab/lib/empty-state.js';

// What an empty lab tells a designer: plain words, things to ask Claude, nothing to do with git or code.
describe('the empty lab', () => {
  for (const [kind, state] of Object.entries(EMPTY_STATES)) {
    describe(kind, () => {
      it('has a title, a line saying what to do, requests to copy and a tip', () => {
        expect(state.title.length).toBeGreaterThan(3);
        expect(state.lead).toMatch(/Claude/);
        expect(state.prompts.length).toBeGreaterThanOrEqual(2);
        expect(state.tip.length).toBeGreaterThan(10);
      });
      it('asks Claude in plain words: no git or code jargon', () => {
        const all = [state.title, state.lead, state.tip, ...state.prompts].join(' ');
        expect(all).not.toMatch(/\b(git|commit|branch|merge|push|pull|npm|terminal|json|typescript)\b/i);
      });
      it('has requests that are different from each other and end like a sentence or a prompt to fill in', () => {
        expect(new Set(state.prompts).size).toBe(state.prompts.length);
        for (const p of state.prompts) expect(p).toMatch(/[.)]$/);
      });
    });
  }
  it('has an empty state for the components and for the pages', () => {
    expect(Object.keys(EMPTY_STATES).sort()).toEqual(['components', 'pages']);
  });
});
