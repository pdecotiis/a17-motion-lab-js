import type { ProjectTrigger } from '../lab/lib/project-triggers.js';

// interval: the component goes to the next of its states by itself, `every` after the last state change (a click, or this trigger's own step, starts the wait
// again), back to the first after the last. Not while an entrance plays and not under prefers-reduced-motion.
//   { on: 'interval', every: '5000ms' (or a duration or delay token), toggle: ['default', 'layout-2', ...], pause?: 'playpause' }
// `pause` names the data-motion element that pauses and resumes it (a play/pause button): the root gets data-pausable (so the stylesheet can show the button) and
// data-paused while it is paused (so a progress bar can stop with it); resuming carries on with the time that was left.
type Settings = { on: 'interval'; every: string; toggle: string[]; pause?: string };

const msOf = (every: string, raw: Record<string, unknown>): number => {
  const text = String(raw[every] ?? every);
  return text.endsWith('ms') ? parseFloat(text) : text.endsWith('s') ? parseFloat(text) * 1000 : parseFloat(text);
};

const trigger: ProjectTrigger = {
  name: 'interval',

  validate(settings, { id, states }) {
    const { every, toggle } = settings as unknown as Partial<Settings>;
    if (typeof every !== 'string' || every === '') throw new Error(`${id} interval trigger needs "every": a duration or delay token, or a time such as "5000ms"`);
    if (settings['pause'] !== undefined && typeof settings['pause'] !== 'string') throw new Error(`${id} interval trigger's "pause" is the data-motion name of a button`);
    if (!Array.isArray(toggle) || toggle.length < 2 || new Set(toggle).size !== toggle.length) throw new Error(`${id} interval trigger needs a list of two or more different states to step through`);
    for (const s of toggle) if (!states.includes(s)) throw new Error(`${id} interval trigger steps through "${s}", which is not one of its states (${states.join(', ')})`);
  },

  attach(settings, ctx) {
    const { every, toggle, pause } = settings as unknown as Settings;
    const ms = msOf(every, ctx.raw);
    let timer = 0;
    let paused = false;
    let left = ms / ctx.playbackRate();   // how long is left of the wait (a pause keeps what was left)
    let startedAt = 0;
    const run = (): void => {
      window.clearTimeout(timer);
      startedAt = performance.now();
      timer = window.setTimeout(() => {
        // an entrance is playing, or reduced motion is on: do nothing this time and wait again
        if (!ctx.isLocked() && !ctx.reducedMotion()) ctx.goTo(toggle[(toggle.indexOf(ctx.base()) + 1) % toggle.length]!);
        arm();
      }, left);
    };
    const arm = (): void => {
      left = ms / ctx.playbackRate();
      if (!paused) run();
    };
    const stop = ctx.onMoved(arm);   // any move (a click, the state buttons) starts the wait again
    const stopReset = ctx.onReset(arm);
    const button = pause ? ctx.el.querySelector<HTMLElement>(`[data-motion="${pause}"]`) : null;
    const toggleButton = (): void => {
      paused = !paused;
      ctx.el.toggleAttribute('data-paused', paused);
      button?.setAttribute('aria-pressed', String(paused));
      if (paused) { window.clearTimeout(timer); left -= performance.now() - startedAt; } else run();
    };
    if (button) { ctx.el.setAttribute('data-pausable', ''); button.addEventListener('click', toggleButton); }
    arm();
    return () => {
      window.clearTimeout(timer); stop(); stopReset();
      button?.removeEventListener('click', toggleButton);
      ctx.el.removeAttribute('data-pausable'); ctx.el.removeAttribute('data-paused');
    };
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

  exportCode(settings) {
    const pause = (settings as unknown as Settings).pause;
    return [
      '// interval: step to the next state by itself, `every` ms after the last change (not under reduced motion)',
      'let timer;',
      ...(pause ? ['let left = t.every;   // what is left of the wait, kept while paused', 'let startedAt;', 'let paused = false;'] : []),
      'const rearm = () => {',
      '  clearTimeout(timer);',
      ...(pause ? ['  left = t.every;', '  if (paused) return;', '  startedAt = performance.now();'] : []),
      '  timer = setTimeout(() => {',
      '    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;',
      '    show(t.toggle[(t.toggle.indexOf(el.dataset.state) + 1) % t.toggle.length]);',
      pause ? '  }, left);' : '  }, t.every);',
      '};',
      'afterShow.push(rearm);',
      'rearm();',
      ...(pause ? [
        '',
        `// the play / pause button: pausing keeps what was left of the wait, resuming carries on with it`,
        `el.querySelector('[data-motion="${pause}"]').addEventListener("click", () => {`,
        '  paused = !paused;',
        '  el.toggleAttribute("data-paused", paused);',
        '  if (paused) { clearTimeout(timer); left -= performance.now() - startedAt; }',
        '  else { startedAt = performance.now(); timer = setTimeout(() => show(t.toggle[(t.toggle.indexOf(el.dataset.state) + 1) % t.toggle.length]), left); }',
        '});',
      ] : []),
    ];
  },
};

export default trigger;
