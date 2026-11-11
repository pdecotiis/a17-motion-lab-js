import type { ProjectTrigger } from '../lab/lib/project-triggers.js';

// sequence: the component goes to a list of states by itself, each at its own time after it appears (or is replayed). It is the clock of a page's opening:
// several components start the same clock and each steps to its own states, so they stay together without knowing about each other.
//   { on: 'sequence', steps: [['layout-2', '250ms'], ['layout-3', '500ms'], ['default', '750ms']] }
// A step waits while an entrance is still playing. Under reduced motion it goes straight to the last state.
type Settings = { on: 'sequence'; steps: [string, string][] };

const msOf = (time: string, raw: Record<string, unknown>): number => {
  const text = String(raw[time] ?? time);
  return text.endsWith('ms') ? parseFloat(text) : text.endsWith('s') ? parseFloat(text) * 1000 : parseFloat(text);
};

const trigger: ProjectTrigger = {
  name: 'sequence',

  validate(settings, { id, states }) {
    const { steps } = settings as unknown as Partial<Settings>;
    if (!Array.isArray(steps) || steps.length === 0) throw new Error(`${id} sequence trigger needs "steps": a list of [state, time] pairs`);
    for (const step of steps) {
      const [state, time] = step ?? [];
      if (typeof state !== 'string' || typeof time !== 'string' || time === '') throw new Error(`${id} sequence trigger steps are [state, time] pairs, such as ['open', '400ms']`);
      if (!states.includes(state)) throw new Error(`${id} sequence trigger goes to "${state}", which is not one of its states (${states.join(', ')})`);
    }
  },

  attach(settings, ctx) {
    const { steps } = settings as unknown as Settings;
    let timers: number[] = [];
    const clear = (): void => { timers.forEach(timer => window.clearTimeout(timer)); timers = []; };
    // an entrance may still be playing when a step is due: wait for it
    const go = (state: string): void => {
      if (ctx.isLocked()) timers.push(window.setTimeout(() => go(state), 50));
      else ctx.goTo(state);
    };
    const start = (): void => {
      clear();
      if (ctx.reducedMotion()) { go(steps[steps.length - 1]![0]); return; }
      for (const [state, time] of steps) timers.push(window.setTimeout(() => go(state), msOf(time, ctx.raw) / ctx.playbackRate()));
    };
    const stop = ctx.onReset(start);   // a replay, and the end of the entrance, start the clock again
    start();
    return () => { clear(); stop(); };
  },

  describe(settings) {
    const { steps } = settings as unknown as Settings;
    return {
      heading: 'Sequence',
      summary: `By itself, it goes to ${steps.map(([state, time]) => `${state} at ${time}`).join(', then ')} after it appears (straight to ${steps[steps.length - 1]![0]} with reduced motion).`,
      led: steps.map(([state]) => state),
      event: 'sequence',
      on: 'a timer',
      means: 'the time after the component appears',
      what: `goes to ${steps.map(([state, time]) => `**${state}** at ${time}`).join(', then ')}; straight to **${steps[steps.length - 1]![0]}** under reduced motion. The CSS has no timer: the GSAP and Motion \`attach…(el)\` functions run it`,
    };
  },

  exportSettings(settings, raw) {
    const { steps } = settings as unknown as Settings;
    return { ...settings, steps: steps.map(([state, time]) => [state, msOf(time, raw)]) };
  },

  exportCode() {
    return [
      '// sequence: go to each state at its time after the component appears (straight to the last one under reduced motion)',
      'const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;',
      'const steps = reduced ? [t.steps[t.steps.length - 1]] : t.steps;',
      'for (const [state, at] of steps) {',
      '  const timer = setTimeout(() => { base = state; settle(); }, reduced ? 0 : at);',
      '  off.push(() => clearTimeout(timer));',
      '}',
    ];
  },
};

export default trigger;
