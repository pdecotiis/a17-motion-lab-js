import type { CustomTrigger } from './types.js';

// Project triggers. The lab has a few triggers of its own that every project needs and that plain CSS can do (hover, press, focus, click, arrows). Anything else a
// project needs ("step to the next state every five seconds", "when the page scrolls past here") is the project's own, and lives in its own folder, /triggers/,
// one file per trigger, found automatically (like components) and never touched by a merge from the template. A file default-exports a ProjectTrigger:
//
//   export default {
//     name: 'interval',                       // what a version writes: { on: 'interval', ... }; lowercase letters, numbers, hyphens; not a lab trigger's name
//     validate(settings, { id, states }) {},  // throw an Error that says what is wrong
//     attach(settings, ctx) { ...; return () => { /* stop */ }; },   // the lab player: listen, and move the component with ctx
//     describe(settings) { return { heading, summary, led, event, on, means, what }; },   // what "What it does" and spec.md say
//     exportSettings(settings, raw) { return settings; },             // optional: the settings as written into the code (resolve tokens to numbers)
//     exportCode(settings) { return ['...']; },                       // the same trigger as plain JavaScript lines for the GSAP and Motion files
//   } satisfies ProjectTrigger;
//
// `settings` is the trigger as the version writes it ({ on: 'interval', every: '5000ms', toggle: [...] }).

/** What a trigger gets to move the component with, in the lab. */
export interface TriggerContext {
  /** The component's root element. */
  el: HTMLElement;
  /** The token values, by path (`duration.250` is "250ms"). */
  raw: Record<string, unknown>;
  /** Go to a state and make it the new base state (like a click that sets one). */
  goTo(state: string): void;
  /** The base state: where the component rests when nothing is held (what a hover or press returns to). */
  base(): string;
  /** True while an entrance is playing: the states do not respond yet. */
  isLocked(): boolean;
  reducedMotion(): boolean;
  /** The lab's speed control (1 = normal); divide a wait by it. */
  playbackRate(): number;
  /** Call `fn` every time the component moves to another state (by anything: a click, this trigger, the state buttons). Returns the function that stops it. */
  onMoved(fn: () => void): () => void;
}

/** What a trigger says about itself, for "What it does" (heading, summary) and spec.md (a table row: event, on, means, what happens). */
export interface TriggerDescription {
  heading: string;
  summary: string;
  /** The states this trigger leads to (so they are not reported as "set from outside"). */
  led: string[];
  event: string;
  on: string;
  means: string;
  what: string;
}

export interface ProjectTrigger {
  name: string;
  validate(settings: CustomTrigger, info: { id: string; states: string[] }): void;
  attach(settings: CustomTrigger, ctx: TriggerContext): () => void;
  describe(settings: CustomTrigger): TriggerDescription;
  exportSettings?(settings: CustomTrigger, raw: Record<string, unknown>): CustomTrigger;
  /**
   * The trigger as plain JavaScript lines, placed inside the exported `attach…(el)` function (GSAP and Motion share them). In scope: `t` (the trigger's
   * settings as written by exportSettings), `el`, `base` (assignable: the base state), `settle()` (go to where the component should be now), `on(node, type, fn)`
   * (add a listener that is removed when attach's result is called), `off` (an array of functions to run on removal: push your own) and `afterMove`
   * (an array of functions called after every move: push one to run on each state change). Without it the code says the trigger needs wiring by hand.
   */
  exportCode?(settings: CustomTrigger): string[];
}

const registry = new Map<string, ProjectTrigger>();
const NAME = /^[a-z][a-z0-9-]*$/;
const CORE = ['hover', 'press', 'focus', 'click', 'arrows'];

export function registerTrigger(trigger: ProjectTrigger): void {
  if (!NAME.test(trigger.name)) throw new Error(`A project trigger's name must be lowercase letters, numbers and hyphens: "${trigger.name}"`);
  if (CORE.includes(trigger.name)) throw new Error(`"${trigger.name}" is one of the lab's own triggers: a project trigger needs another name`);
  registry.set(trigger.name, trigger);
}
export const getTrigger = (name: string): ProjectTrigger | undefined => registry.get(name);
export const projectTriggerNames = (): string[] => [...registry.keys()];
/** Forget every trigger (for tests). */
export function clearTriggers(): void { registry.clear(); }

// The project's own: /triggers/<name>.ts, each a default export.
const modules = import.meta.glob<{ default: ProjectTrigger }>('../../triggers/*.ts', { eager: true });
for (const m of Object.values(modules)) if (m.default) registerTrigger(m.default);
