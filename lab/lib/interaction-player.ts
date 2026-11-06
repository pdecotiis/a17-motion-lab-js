import { animate as motionAnimate } from 'motion';
import type { InteractionTrigger, MotionVersion, ReducedMotionPolicy, StateValues } from './types.js';
import { cssHandle, type PlayHandle, type Runtime } from './runtime.js';
import { cssTransitionPlan, interactionParts, motionStates, motionTransitionPlan, partProps, partValues, resolveState, stateNames } from './interaction.js';

// Plays a component's states in the lab. One player per component element: it knows which state the
// component is in, moves the component (the root, and each layer that has values) to another state from
// wherever it is NOW, and listens for the events the version declares (hover, press, focus, click).
//   CSS     a new animation from the current computed values; the old one's speed is lost
//   Motion  a spring from the current value (Motion's duration-based springs do not carry the old speed either)

export interface PlayerDeps {
  raw: Record<string, unknown>;
  runtime: Runtime;
  globalBounce: string;
  reducedMotion: () => boolean;
  reducedPolicy: ReducedMotionPolicy;
  playbackRate: () => number;
  /** Called when the state changes, and when a transition ends. */
  onChange?: (state: string, transitioning: boolean) => void;
  /** Called with each move that animates, so the speed control can reach it. */
  onHandle?: (handle: PlayHandle) => void;
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
  /**
   * While locked the triggers do nothing (hover, press, focus and click are ignored, and nothing is held):
   * an entrance is still playing, and the states take over when it ends.
   */
  setLocked(locked: boolean): void;
  /** Listen for the version's triggers on the element and its layers. Returns the function that stops listening. */
  attachTriggers(): () => void;
}

const kebab = (p: string): string => p.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

// Several moves as one: the speed control, restarting and cancelling reach all of them.
function groupHandle(target: Element, handles: PlayHandle[]): PlayHandle {
  const first = handles[0]!;
  return {
    target,
    get speed() { return first.speed; },
    set speed(v: number) { handles.forEach(h => { h.speed = v; }); },
    get time() { return first.time; },
    set time(v: number) { handles.forEach(h => { h.time = v; }); },
    get finished() { return handles.every(h => h.finished); },
    done: Promise.all(handles.map(h => h.done ?? Promise.resolve())),
    cancel() { handles.forEach(h => h.cancel()); },
  };
}

// A part of the component that moves: the root (name null), or the elements of a layer.
interface Part { name: string | null; els: HTMLElement[]; props: string[] }

export function createInteractionPlayer(el: HTMLElement, version: MotionVersion, deps: PlayerDeps): InteractionPlayer {
  const interaction = version.interaction;
  if (!interaction) throw new Error(`Version "${version.id}" has no interaction`);
  const names = stateNames(interaction);
  const parts: Part[] = interactionParts(interaction)
    .map(name => ({
      name,
      els: name === null ? [el] : [...el.querySelectorAll<HTMLElement>(`[data-motion="${name}"]`)],
      props: partProps(interaction, name),
    }))
    .filter(p => p.els.length > 0 && p.props.length > 0);

  let current = interaction.initial;
  // The state the component is in when nothing is holding it elsewhere: the resting state, or what a click or
  // the stage's buttons last set. A hover, press or focus holds it in its own state while it lasts; with
  // several at once, the latest wins, and when one ends the component goes to the one beneath it, or base.
  let base = interaction.initial;
  const holds: object[] = [];
  const holdState = new Map<object, string>();
  const cssAnims = new Map<HTMLElement, Animation>();
  let transitioning = false;
  let locked = false;

  const setInline = (target: HTMLElement, values: StateValues): void => {
    for (const [k, v] of Object.entries(values)) target.style.setProperty(kebab(k), String(v));
  };
  const setState = (s: string): void => {
    current = s;
    el.dataset['state'] = s;
  };
  // An element's values right now, mid-animation included.
  const computed = (target: HTMLElement, props: string[]): StateValues => {
    const cs = getComputedStyle(target);
    return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(kebab(p))]));
  };

  const applyInstant = (state: string): Promise<void> => {
    for (const a of cssAnims.values()) a.cancel();
    cssAnims.clear();
    setState(state);
    transitioning = false;
    if (deps.runtime === 'motion') {
      const done = parts.map(part => Promise.resolve(motionAnimate(part.els, motionStates(interaction, deps.raw, part.name)[state]!, { duration: 0.001 })));
      return Promise.all(done).then(() => undefined);
    }
    for (const part of parts) for (const e of part.els) setInline(e, resolveState(partValues(interaction, part.name, state), deps.raw));
    return Promise.resolve();
  };

  const finish = (to: string, pending: Promise<unknown>[]): void => {
    transitioning = true;
    void Promise.all(pending).then(() => {
      if (current !== to || cssAnims.size > 0) return;
      transitioning = false;
      deps.onChange?.(to, false);
    }).catch(() => { /* interrupted */ });
  };

  const goToCss = (to: string): PlayHandle | null => {
    const handles: PlayHandle[] = [];
    const pending: Promise<unknown>[] = [];
    for (const part of parts) {
      const plan = cssTransitionPlan(interaction, to, deps.raw, { reducedMotion: deps.reducedMotion(), reducedPolicy: deps.reducedPolicy, target: part.name });
      const keys = Object.keys(plan.animate);
      for (const e of part.els) {
        const from = computed(e, part.props);
        cssAnims.get(e)?.cancel();
        cssAnims.delete(e);
        setInline(e, from);       // hold where it is, so cancelling the old animation doesn't jump
        setInline(e, plan.snap);
        if (keys.length === 0) continue;
        const anim = e.animate(
          [Object.fromEntries(keys.map(k => [k, from[k]!])), plan.animate],
          { duration: plan.duration, delay: plan.delay, easing: plan.easing, fill: 'forwards' },
        );
        anim.playbackRate = deps.playbackRate();
        cssAnims.set(e, anim);
        handles.push(cssHandle(e, anim));
        pending.push(anim.finished.then(() => {
          if (cssAnims.get(e) !== anim) return;
          setInline(e, plan.animate);
          anim.cancel();
          cssAnims.delete(e);
        }).catch(() => { /* cancelled by the next transition */ }));
      }
    }
    setState(to);
    if (handles.length === 0) { transitioning = false; deps.onChange?.(to, false); return null; }
    finish(to, pending);
    return groupHandle(el, handles);
  };

  const goToMotion = (to: string): PlayHandle | null => {
    const handles: PlayHandle[] = [];
    const pending: Promise<unknown>[] = [];
    for (const part of parts) {
      const plan = motionTransitionPlan(interaction, to, deps.raw, { reducedMotion: deps.reducedMotion(), reducedPolicy: deps.reducedPolicy, globalBounce: deps.globalBounce, target: part.name });
      if (Object.keys(plan.snap).length) motionAnimate(part.els, plan.snap, { duration: 0.001 });
      if (Object.keys(plan.animate).length === 0) continue;
      const controls = motionAnimate(part.els, plan.animate, plan.options);
      controls.speed = deps.playbackRate();
      pending.push(Promise.resolve(controls));
      handles.push({
        target: part.els[0]!,
        get speed() { return controls.speed; },
        set speed(v: number) { controls.speed = v; },
        get time() { return controls.time; },
        set time(v: number) { controls.time = v; },
        get finished() { return controls.state === 'finished'; },
        done: Promise.resolve(controls).then(() => undefined, () => undefined),
        cancel() { controls.cancel(); },
      });
    }
    setState(to);
    if (handles.length === 0) { transitioning = false; deps.onChange?.(to, false); return null; }
    finish(to, pending);
    return groupHandle(el, handles);
  };

  const move = (to: string): PlayHandle | null => {
    if (!names.includes(to)) throw new Error(`Unknown state "${to}" (${names.join(', ')})`);
    if (to === current && !transitioning) return null;
    deps.onChange?.(to, true);
    const handle = deps.runtime === 'motion' ? goToMotion(to) : goToCss(to);
    if (handle) deps.onHandle?.(handle);
    return handle;
  };
  // Where the component should be now: the state of the latest hold, else the base.
  const settle = (): PlayHandle | null => {
    const top = holds[holds.length - 1];
    return move(top ? holdState.get(top)! : base);
  };

  const api: InteractionPlayer = {
    state: () => current,
    states: () => names,
    // Going to a state yourself (the stage's buttons, a click) makes it the new base and clears the holds.
    goTo(to) {
      if (!names.includes(to)) throw new Error(`Unknown state "${to}" (${names.join(', ')})`);
      base = to;
      holds.length = 0;
      holdState.clear();
      return move(to);
    },
    setLocked(value) {
      locked = value;
      if (value) { holds.length = 0; holdState.clear(); }
    },
    toggle() {
      return api.goTo(names[(names.indexOf(current) + 1) % names.length]!);
    },
    async reset() {
      base = interaction.initial;
      holds.length = 0;
      holdState.clear();
      const applied = applyInstant(interaction.initial);
      deps.onChange?.(interaction.initial, false);
      await applied;
    },
    attachTriggers() {
      const cleanups: (() => void)[] = [];
      const listen = (target: EventTarget, type: string, fn: (e: Event) => void): void => {
        target.addEventListener(type, fn);
        cleanups.push(() => target.removeEventListener(type, fn));
      };
      const elsFor = (t: InteractionTrigger): HTMLElement[] =>
        t.target ? [...el.querySelectorAll<HTMLElement>(`[data-motion="${t.target}"]`)] : [el];

      for (const t of interaction.triggers ?? []) {
        // Arrow keys step through a list of states, left to right: heard on the whole page, but not while typing in a field.
        if (t.on === 'arrows') {
          listen(document, 'keydown', ev => {
            const k = ev as KeyboardEvent;
            if (locked || k.defaultPrevented || k.altKey || k.ctrlKey || k.metaKey || k.shiftKey) return;
            if (k.key !== 'ArrowLeft' && k.key !== 'ArrowRight') return;
            if ((k.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
            const right = k.key === 'ArrowRight';
            const at = t.states.indexOf(base);
            const next = at < 0 ? (right ? 0 : t.states.length - 1) : at + (right ? 1 : -1);
            if (next < 0 || next >= t.states.length) return;
            base = t.states[next]!;
            settle();
            k.preventDefault();
          });
          continue;
        }
        const els = elsFor(t);
        if (els.length === 0) continue;

        if (t.on === 'click') {
          for (const e of els) listen(e, 'click', () => {
            if (locked) return;
            if ('set' in t && t.set !== undefined) base = t.set;
            else if ('toggle' in t && t.toggle !== undefined) base = base === t.toggle[0] ? t.toggle[1] : t.toggle[0];
            settle();
          });
          continue;
        }

        // Hover, press and focus: hold the component in the state while it lasts; when it ends, it goes to
        // whatever else is holding it, or back to the base.
        const state = t.state;
        const hold = {};
        const enter = (): void => {
          if (locked || holds.includes(hold)) return;
          holds.push(hold);
          holdState.set(hold, state);
          settle();
        };
        const leave = (): void => {
          const at = holds.indexOf(hold);
          if (at < 0) return;
          holds.splice(at, 1);
          holdState.delete(hold);
          settle();
        };
        for (const e of els) {
          if (t.on === 'hover') {
            // A touch has no hover: only a mouse or a pen moves the pointer over an element.
            listen(e, 'pointerenter', ev => { if ((ev as PointerEvent).pointerType !== 'touch') enter(); });
            listen(e, 'pointerleave', () => leave());
          } else if (t.on === 'press') {
            listen(e, 'pointerdown', ev => {
              if ((ev as PointerEvent).button > 0) return;
              enter();
              const end = (): void => {
                leave();
                document.removeEventListener('pointerup', end);
                document.removeEventListener('pointercancel', end);
              };
              document.addEventListener('pointerup', end);
              document.addEventListener('pointercancel', end);
              cleanups.push(() => { document.removeEventListener('pointerup', end); document.removeEventListener('pointercancel', end); });
            });
          } else {
            // focus: a keyboard focus (not a mouse click on a button), on the element or anything inside it
            listen(e, 'focusin', ev => { if ((ev.target as HTMLElement).matches(':focus-visible')) enter(); });
            listen(e, 'focusout', () => leave());
          }
        }
      }
      return () => cleanups.forEach(c => c());
    },
  };

  void applyInstant(interaction.initial);
  return api;
}
