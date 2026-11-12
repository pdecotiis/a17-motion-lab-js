import type { ProjectTrigger } from '../lab/lib/project-triggers.js';

// interval: the component goes to the next of its states by itself, `every` after the last state change (a click, or this trigger's own step, starts the wait
// again), back to the first after the last. Not while an entrance plays and not under prefers-reduced-motion.
//   { on: 'interval', every: '5000ms' (or a duration or delay token), toggle: ['default', 'layout-2', ...], pause?: 'playpause', pauseOnHover?: ['o0', 'dots', ...] }
// `pause` names the data-motion element that pauses and resumes it (a play/pause button): the root gets data-pausable (so the stylesheet can show the button) and
// data-paused while it is paused. `pauseOnHover` names elements (data-motion) that hold the wait while the pointer is over one (a touch does not hover): the root gets
// data-held while it is paused or held, so a progress bar can stop with it; resuming carries on with the time that was left.
type Settings = { on: 'interval'; every: string; toggle: string[]; pause?: string; pauseOnHover?: string[] };

const msOf = (every: string, raw: Record<string, unknown>): number => {
  const text = String(raw[every] ?? every);
  return text.endsWith('ms') ? parseFloat(text) : text.endsWith('s') ? parseFloat(text) * 1000 : parseFloat(text);
};

const trigger: ProjectTrigger = {
  name: 'interval',

  validate(settings, { id, states }) {
    const { every, toggle } = settings as unknown as Partial<Settings>;
    if (typeof every !== 'string' || every === '') throw new Error(`${id} interval trigger needs "every": a duration or delay token, or a time such as "5000ms"`);
    if (settings['pauseOnHover'] !== undefined && !(Array.isArray(settings['pauseOnHover']) && settings['pauseOnHover'].every(n => typeof n === 'string'))) throw new Error(`${id} interval trigger's "pauseOnHover" is a list of data-motion names`);
    if (settings['pause'] !== undefined && typeof settings['pause'] !== 'string') throw new Error(`${id} interval trigger's "pause" is the data-motion name of a button`);
    if (!Array.isArray(toggle) || toggle.length < 2 || new Set(toggle).size !== toggle.length) throw new Error(`${id} interval trigger needs a list of two or more different states to step through`);
    for (const s of toggle) if (!states.includes(s)) throw new Error(`${id} interval trigger steps through "${s}", which is not one of its states (${states.join(', ')})`);
  },

  attach(settings, ctx) {
    const { every, toggle, pause, pauseOnHover = [] } = settings as unknown as Settings;
    const ms = msOf(every, ctx.raw);
    let timer = 0;
    let running = false;
    let paused = false;
    const hovered = new Set<Element>();
    let left = ms / ctx.playbackRate();   // how long is left of the wait (a pause or a hover keeps what was left)
    let startedAt = 0;
    const held = (): boolean => paused || hovered.size > 0;
    const run = (): void => {
      window.clearTimeout(timer);
      running = true;
      startedAt = performance.now();
      timer = window.setTimeout(() => {
        running = false;
        // an entrance is playing, or reduced motion is on: do nothing this time and wait again
        if (!ctx.isLocked() && !ctx.reducedMotion()) ctx.goTo(toggle[(toggle.indexOf(ctx.base()) + 1) % toggle.length]!);
        arm();
      }, left);
    };
    const arm = (): void => {
      window.clearTimeout(timer);
      running = false;
      left = ms / ctx.playbackRate();
      if (!held()) run();
    };
    // stop the clock while held, carry on with what was left when let go
    const sync = (): void => {
      ctx.el.toggleAttribute('data-held', held());
      if (held() && running) { window.clearTimeout(timer); running = false; left -= performance.now() - startedAt; }
      else if (!held() && !running) run();
    };
    const stop = ctx.onMoved(arm);   // any move (a click, the state buttons) starts the wait again
    const stopReset = ctx.onReset(arm);
    const button = pause ? ctx.el.querySelector<HTMLElement>(`[data-motion="${pause}"]`) : null;
    const toggleButton = (): void => {
      paused = !paused;
      ctx.el.toggleAttribute('data-paused', paused);
      button?.setAttribute('aria-pressed', String(paused));
      sync();
    };
    if (button) { ctx.el.setAttribute('data-pausable', ''); button.addEventListener('click', toggleButton); }
    const listeners: [Element, string, (e: Event) => void][] = [];
    for (const name of pauseOnHover) {
      for (const node of ctx.el.querySelectorAll(`[data-motion="${name}"]`)) {
        const enter = (e: Event): void => { if ((e as PointerEvent).pointerType !== 'touch') { hovered.add(node); sync(); } };
        const leave = (): void => { hovered.delete(node); sync(); };
        node.addEventListener('pointerenter', enter); node.addEventListener('pointerleave', leave);
        listeners.push([node, 'pointerenter', enter], [node, 'pointerleave', leave]);
      }
    }
    arm();
    return () => {
      window.clearTimeout(timer); stop(); stopReset();
      button?.removeEventListener('click', toggleButton);
      for (const [node, type, fn] of listeners) node.removeEventListener(type, fn);
      ctx.el.removeAttribute('data-pausable'); ctx.el.removeAttribute('data-paused'); ctx.el.removeAttribute('data-held');
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
    const { pause, pauseOnHover = [] } = settings as unknown as Settings;
    const next = 'show(t.toggle[(t.toggle.indexOf(el.dataset.state) + 1) % t.toggle.length])';
    if (!pause && pauseOnHover.length === 0) {
      return [
        '// interval: step to the next state by itself, `every` ms after the last change (not under reduced motion)',
        'let timer;',
        'const rearm = () => {',
        '  clearTimeout(timer);',
        '  timer = setTimeout(() => {',
        '    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;',
        `    ${next};`,
        '  }, t.every);',
        '};',
        'afterShow.push(rearm);',
        'rearm();',
      ];
    }
    return [
      '// interval: step to the next state by itself, `every` ms after the last change (not under reduced motion).',
      '// It waits while paused (the play / pause button) or while the pointer is over a card or the pagination pill, and carries on with the time that was left.',
      'let timer;',
      'let left = t.every;   // what is left of the wait',
      'let startedAt;',
      'let running = false;',
      'let paused = false;',
      'let hovering = 0;',
      'const held = () => paused || hovering > 0;',
      'const run = () => {',
      '  running = true;',
      '  startedAt = performance.now();',
      '  timer = setTimeout(() => {',
      '    running = false;',
      '    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;',
      `    ${next};`,
      '  }, left);',
      '};',
      'const rearm = () => {',
      '  clearTimeout(timer);',
      '  running = false;',
      '  left = t.every;',
      '  if (!held()) run();',
      '};',
      'const sync = () => {',
      '  el.toggleAttribute("data-held", held());',
      '  if (held() && running) { clearTimeout(timer); running = false; left -= performance.now() - startedAt; }',
      '  else if (!held() && !running) run();',
      '};',
      'afterShow.push(rearm);',
      'rearm();',
      ...(pause ? [
        '',
        '// the play / pause button',
        `el.querySelector('[data-motion="${pause}"]').addEventListener("click", () => {`,
        '  paused = !paused;',
        '  el.toggleAttribute("data-paused", paused);',
        '  sync();',
        '});',
      ] : []),
      ...(pauseOnHover.length ? [
        '',
        '// hovering one of these holds the wait (a touch does not hover)',
        `for (const node of el.querySelectorAll(${JSON.stringify(pauseOnHover.map(n => `[data-motion="${n}"]`).join(', '))})) {`,
        '  node.addEventListener("pointerenter", e => { if (e.pointerType !== "touch") { hovering++; sync(); } });',
        '  node.addEventListener("pointerleave", () => { hovering = Math.max(0, hovering - 1); sync(); });',
        '}',
      ] : []),
    ];
  },
};

export default trigger;
