import type { ProjectTrigger } from '../lab/lib/project-triggers.js';

// interval: the component goes to the next of its states by itself, `every` after the last state change (a click, or this trigger's own step, starts the wait
// again), back to the first after the last. Not while an entrance plays and not under prefers-reduced-motion.
//   { on: 'interval', every: '5000ms' (or a duration or delay token), toggle: ['default', 'layout-2', ...] }
type Settings = { on: 'interval'; every: string; toggle: string[] };

const msOf = (every: string, raw: Record<string, unknown>): number => {
  const text = String(raw[every] ?? every);
  return text.endsWith('ms') ? parseFloat(text) : text.endsWith('s') ? parseFloat(text) * 1000 : parseFloat(text);
};

const trigger: ProjectTrigger = {
  name: 'interval',

  validate(settings, { id, states }) {
    const { every, toggle } = settings as unknown as Partial<Settings>;
    if (typeof every !== 'string' || every === '') throw new Error(`${id} interval trigger needs "every": a duration or delay token, or a time such as "5000ms"`);
    if (!Array.isArray(toggle) || toggle.length < 2 || new Set(toggle).size !== toggle.length) throw new Error(`${id} interval trigger needs a list of two or more different states to step through`);
    for (const s of toggle) if (!states.includes(s)) throw new Error(`${id} interval trigger steps through "${s}", which is not one of its states (${states.join(', ')})`);
  },

  attach(settings, ctx) {
    const { every, toggle } = settings as unknown as Settings;
    const ms = msOf(every, ctx.raw);
    let timer = 0;
    const arm = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // an entrance is playing, or reduced motion is on: do nothing this time and wait again
        if (!ctx.isLocked() && !ctx.reducedMotion()) ctx.goTo(toggle[(toggle.indexOf(ctx.base()) + 1) % toggle.length]!);
        arm();
      }, ms / ctx.playbackRate());
    };
    const stop = ctx.onMoved(arm);   // any move (a click, the state buttons) starts the wait again
    arm();
    return () => { window.clearTimeout(timer); stop(); };
  },

  describe(settings) {
    const { every, toggle } = settings as unknown as Settings;
    return {
      heading: 'Timer',
      summary: `By itself, ${every} after the last change, it goes to the next of ${toggle.join(', ')}, back to ${toggle[0]} after ${toggle[toggle.length - 1]} (a click starts the wait again; not with reduced motion).`,
      led: toggle,
      event: 'interval',
      on: 'a timer',
      means: `${every} after the last state change`,
      what: `goes to the next of ${toggle.map(s => `**${s}**`).join(', ')}, back to **${toggle[0]}** after the last; a click (or anything that sets \`data-state\`) starts the wait again; not under reduced motion. The CSS has no timer: the GSAP and Motion \`attach…(el)\` functions run it`,
    };
  },

  exportSettings(settings, raw) {
    return { ...settings, every: msOf((settings as unknown as Settings).every, raw) };
  },

  exportCode() {
    return [
      '// interval: step to the next state by itself, `every` ms after the last change (not under reduced motion)',
      'let timer;',
      'const rearm = () => {',
      '  clearTimeout(timer);',
      '  timer = setTimeout(() => {',
      '    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) base = t.toggle[(t.toggle.indexOf(base) + 1) % t.toggle.length];',
      '    settle();',
      '  }, t.every);',
      '};',
      'afterMove.push(rearm);',
      'off.push(() => clearTimeout(timer));',
      'rearm();',
    ];
  },
};

export default trigger;
