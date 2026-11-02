import { animate as motionAnimate } from 'motion';
import type { MotionVersion, ReducedMotionPolicy, StateValues } from './types.js';
import { cssHandle, type PlayHandle, type Runtime } from './runtime.js';
import { cssTransitionPlan, motionStates, motionTransitionPlan, resolveState, stateNames, stateProps } from './interaction.js';

// Plays a component's states in the lab (spike). One player per element: it knows which state the
// component is in, and moving it to another state runs that transition with the current runtime,
// from wherever the element is NOW. That is the point of the spike: interrupt a transition halfway
// and see what each runtime does with the speed it had.
//   CSS     a new animation from the current computed values; the old one's speed is lost
//   Motion  a spring from the current value, carrying the speed the previous spring had

export interface PlayerDeps {
  raw: Record<string, unknown>;
  runtime: Runtime;
  globalBounce: string;
  reducedMotion: () => boolean;
  reducedPolicy: ReducedMotionPolicy;
  playbackRate: () => number;
  /** Called when the state changes, and when a transition ends. */
  onChange?: (state: string, transitioning: boolean) => void;
}

export interface InteractionPlayer {
  state(): string;
  states(): string[];
  goTo(state: string): PlayHandle | null;
  /** The next state after this one, wrapping round: for two states, a toggle. */
  toggle(): PlayHandle | null;
  /**
   * Back to the resting state at once, no animation. Resolves when it has taken effect: Motion applies
   * an instant set on its next frame, so a transition that follows must wait for it.
   */
  reset(): Promise<void>;
}

const kebab = (p: string): string => p.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

export function createInteractionPlayer(el: HTMLElement, version: MotionVersion, deps: PlayerDeps): InteractionPlayer {
  const interaction = version.interaction;
  if (!interaction) throw new Error(`Version "${version.id}" has no interaction`);
  const props = stateProps(interaction);
  const names = stateNames(interaction);
  const motionVals = motionStates(interaction, deps.raw);
  let current = interaction.initial;
  let cssAnim: Animation | null = null;
  let transitioning = false;

  const setInline = (values: StateValues): void => {
    for (const [k, v] of Object.entries(values)) el.style.setProperty(kebab(k), String(v));
  };
  const setState = (s: string): void => {
    current = s;
    el.dataset['state'] = s;
  };

  // The element's values right now, mid-animation included.
  const computed = (): StateValues => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(kebab(p))]));
  };

  const applyInstant = (state: string): Promise<void> => {
    cssAnim?.cancel();
    cssAnim = null;
    setState(state);
    transitioning = false;
    if (deps.runtime === 'motion') {
      const controls = motionAnimate(el, motionVals[state]!, { duration: 0.001 });
      return Promise.resolve(controls).then(() => undefined);
    }
    setInline(resolveState(interaction.states[state]!, deps.raw));
    return Promise.resolve();
  };

  const goToCss = (to: string): PlayHandle | null => {
    const plan = cssTransitionPlan(interaction, to, deps.raw, { reducedMotion: deps.reducedMotion(), reducedPolicy: deps.reducedPolicy });
    const from = computed();
    cssAnim?.cancel();
    cssAnim = null;
    setInline(from);        // hold where it is, so cancelling the old animation doesn't jump
    setInline(plan.snap);
    setState(to);
    const keys = Object.keys(plan.animate);
    if (keys.length === 0) { transitioning = false; deps.onChange?.(to, false); return null; }
    const anim = el.animate(
      [Object.fromEntries(keys.map(k => [k, from[k]!])), plan.animate],
      { duration: plan.duration, delay: plan.delay, easing: plan.easing, fill: 'forwards' },
    );
    anim.playbackRate = deps.playbackRate();
    cssAnim = anim;
    transitioning = true;
    anim.finished.then(() => {
      if (cssAnim !== anim) return;
      setInline(plan.animate);
      anim.cancel();
      cssAnim = null;
      transitioning = false;
      deps.onChange?.(to, false);
    }).catch(() => { /* cancelled by the next transition */ });
    return cssHandle(el, anim);
  };

  const goToMotion = (to: string): PlayHandle | null => {
    const plan = motionTransitionPlan(interaction, to, deps.raw, { reducedMotion: deps.reducedMotion(), reducedPolicy: deps.reducedPolicy, globalBounce: deps.globalBounce });
    if (Object.keys(plan.snap).length) motionAnimate(el, plan.snap, { duration: 0.001 });
    setState(to);
    if (Object.keys(plan.animate).length === 0) { transitioning = false; deps.onChange?.(to, false); return null; }
    const controls = motionAnimate(el, plan.animate, plan.options);
    controls.speed = deps.playbackRate();
    transitioning = true;
    void Promise.resolve(controls).then(() => {
      if (current !== to) return;
      transitioning = false;
      deps.onChange?.(to, false);
    }).catch(() => { /* interrupted */ });
    return {
      target: el,
      get speed() { return controls.speed; },
      set speed(v: number) { controls.speed = v; },
      get time() { return controls.time; },
      set time(v: number) { controls.time = v; },
      get finished() { return controls.state === 'finished'; },
      cancel() { controls.cancel(); },
    };
  };

  void applyInstant(interaction.initial);

  return {
    state: () => current,
    states: () => names,
    goTo(to) {
      if (!names.includes(to)) throw new Error(`Unknown state "${to}" (${names.join(', ')})`);
      if (to === current && !transitioning) return null;
      deps.onChange?.(to, true);
      return deps.runtime === 'motion' ? goToMotion(to) : goToCss(to);
    },
    toggle() {
      return this.goTo(names[(names.indexOf(current) + 1) % names.length]!);
    },
    async reset() {
      const applied = applyInstant(interaction.initial);
      deps.onChange?.(interaction.initial, false);
      await applied;
    },
  };
}
