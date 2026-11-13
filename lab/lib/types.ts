import type { PresetStep } from './entrance-presets.js';

// A tween names its primitives directly: a duration and an easing (token paths, or literal
// values). It plays the easing curve.
export type TweenModel = {
  model: 'tween';
  duration: string;
  easing: string;
  delay?: string;
};

// Token status: 'system' is approved. A token with no status is 'experimental', as new tokens are.
export type TokenStatus = 'system' | 'experimental';

export interface TokenMeta {
  description?: string;  // notes
  status: TokenStatus;
  oldNames?: string[];
}

// One property a spring version moves, from → to.
// property: CSS property name ('opacity', 'transform').
// wrapTransform: wraps value in a transform function, e.g. 'scale' → 'scale(0.94)'.
// unit: appended to the numeric value, e.g. 'px', '%'; default ''.
export interface SpringProperty {
  property: string;
  from: number;
  to: number;
  unit?: string;
  wrapTransform?: string;
}

// A spring names the same primitives as a tween, a duration and an easing, and may name its own
// bounce: a bounce token (`bounce.50`) or a plain number from 0 (no bounce) to 1 (very bouncy).
// Without one it uses the global bounce setting, as every tween does. Only Motion plays it as a
// spring (the duration is its visual duration); the lab never simulates a spring itself. Under CSS
// it plays its from/to values with the easing curve over the duration.
export type SpringModel = {
  model: 'spring';
  duration: string;
  easing: string;
  bounce?: string | number;
  delay?: string;
  properties: SpringProperty[];
};

export type MotionModel = TweenModel | SpringModel;

// ── Interactions (spike) ───────────────────────────────────────────────────
// A version can describe a component's states and the transitions between them, instead of one
// entrance: a panel is closed or open, a button rests or is hovered. The values of a state are motion
// properties only, as in keyframes (token references allowed). A transition is named by the state it
// goes TO, because that is how CSS, GSAP and Motion all take their timing: at the moment you move to a
// state. Going to "open" can bounce while going to "closed" is a plain exit.
export type StateValues = Record<string, string | number>;

export type TransitionTiming =
  | { model: 'tween'; duration: string; easing: string; delay?: string }
  | { model: 'spring'; duration: string; easing: string; bounce?: string | number; delay?: string };

// A layer of the component (the element marked data-motion="<name>") can have its own values for the
// states, and its own timing into them, so a hover can lift the card while the image scales. A property a
// state leaves out is at its natural value there (opacity 1, no transform).
export interface InteractionLayer {
  states: Record<string, StateValues>;
  /** Timing of going TO a state for this layer; the component's own is used where it has none. */
  transitions?: Record<string, TransitionTiming>;
}

// What moves the component between states. It is declared here, in the version, never in the markup: the
// markup comes from the Figma import and a re-import replaces it. `target` is the element the event is
// listened on: a layer's data-motion name, or the component's root when it is left out.
//   hover, press, focus   go to `state` while it lasts, and back to the state it was in when it ends
//   click                 `set` goes to a state; `toggle` goes to the next of its states each click (two swap; three or more cycle, and a click from
//                         a state that is not in the list goes to its first)
//   arrows                the left and right arrow keys step through `states`, left to right (left goes to the one before the
//                         current state, right to the one after; it stops at the ends). Heard anywhere on the page except while
//                         typing in a field.
//   anything else         a project trigger: a file in /triggers/ (see lab/lib/project-triggers.ts), written as { on: '<its name>', ...its own settings }
export type TriggerEvent = 'hover' | 'press' | 'focus' | 'click' | 'arrows';
export type CoreTrigger =
  | { on: 'hover' | 'press' | 'focus'; state: string; target?: string }
  | { on: 'click'; set: string; target?: string }
  | { on: 'click'; toggle: [string, string, ...string[]]; target?: string }
  | { on: 'arrows'; states: string[]; target?: string };
/** A trigger the project defines itself in /triggers/: `on` is its name and the rest are its own settings. */
export interface CustomTrigger { on: string; target?: string; [setting: string]: unknown }
export type InteractionTrigger = CoreTrigger | CustomTrigger;

export interface Interaction {
  /** The state the component rests in, and starts in. */
  initial: string;
  /** How long it rests in the initial state before the first move plays when the version opens or is replayed (a delay or duration token,
   *  or a literal such as "1000ms"). For a version that plays its first move by itself (one with only click or arrow triggers), and after the entrance of one that also appears;
   *  absent = no wait. */
  hold?: string;
  states: Record<string, StateValues>;
  /** Timing of going TO each state; every state needs one. */
  transitions: Record<string, TransitionTiming>;
  /** Values (and optionally timing) for layers inside the component, by data-motion name. */
  layers?: Record<string, InteractionLayer>;
  /** What moves it between states. A trigger on an element outside the component (a button that opens a panel) is the developer's to wire. */
  triggers?: InteractionTrigger[];
}

// Where a component is in review. Approval is the component's, not a version's.
export type ComponentStatus = 'in-progress' | 'review' | 'approved' | 'archived';

// What makes the motion play in production. The lab plays on demand, so this is a spec for the
// developer, not something the lab simulates.
export type TriggerType = 'load' | 'in-view' | 'hover' | 'click' | 'route-change';

export interface MotionTrigger {
  on: TriggerType;
  threshold?: number;  // in-view only: fraction of the element visible (0–1) that fires it
  once?: boolean;      // play the first time only (true) or every time the trigger fires (false)
  each?: boolean;      // in-view only: every animated element (each layer's elements) plays as it enters the view, instead of the whole section at once
}

// What a visitor with prefers-reduced-motion: reduce gets.
// 'fade': opacity-only fade (transforms and travel dropped, REDUCED_MOTION_FADE_MS at most).
// 'none': no animation, the element appears in its end state.
export type ReducedMotionPolicy = 'fade' | 'none';

// A layer is one motion (a tween or a spring and its keyframes) or a preset: see presets.ts.
export type LayerStep = MotionStep | PresetStep;

// One motion: a tween or a spring, and the keyframes a tween plays.
export interface MotionStep {
  model: MotionModel;
  keyframes?: Keyframe[];  // Required for tween; unused for spring (spring uses model.properties)
}

// A version that certainly has a model: the root, and each layer, of any version (an interaction version
// gets one derived from its first transition). What the playback, CSS and export code works on.
export type EntranceVersion = MotionVersion & { model: MotionModel };

export interface MotionVersion {
  id: string;
  label: string;
  // Set by the lab, never written in a version file: the version is named in components/<name>/archived.json (see archived.ts). It stays
  // where it is, disabled.
  archived?: boolean;
  // The motion of an entrance. Optional on an interaction version, which then has its states and
  // transitions instead (see modelOf in motion-models.ts for the timing the panels show).
  model?: MotionModel;
  keyframes?: Keyframe[];  // Required for tween; unused for spring (spring uses model.properties)
  // Motion for layers inside the component, beside the root's own (model, keyframes). The key is the
  // name of a layer, the value of its data-motion attribute (e.g. 'title'). Each layer names its own
  // duration, easing and delay, so text can move differently from the card.
  layers?: Record<string, LayerStep>;
  // The entrance of the root element as a preset (see presets.ts), instead of a model and keyframes.
  entrance?: PresetStep;
  // States and the transitions between them, and what triggers them (hover, press, focus, click).
  interaction?: Interaction;
  // Elements inside the component that respond to the pointer by a preset's own hover and press (a button, a card), keyed by data-motion name:
  // { search: 'button' }, or `root` for the component itself ({ root: 'card' }). Separate from the component's states: the state buttons, holds and triggers of `interaction` never touch them.
  elements?: Record<string, string>;
  stagger?: string;
  trigger?: MotionTrigger;               // absent = not specified; the spec says so rather than guessing
  reducedMotion?: ReducedMotionPolicy;   // absent = 'fade'
  forkedFrom?: string;     // parent version id in the same component
  lineage?: string;        // origin when not forked, e.g. 'imported from <figma link>'
  // Future-ready
  reviewNotes?: string;
}

export interface ComponentModule {
  versions: MotionVersion[];
  defaultVersion: string;
  /** absent = 'in-progress'. Set in the component's motion.ts. */
  status?: ComponentStatus;
}

export interface PageComponent {
  id: string;
  component: string;
  layout?: string;
  /** true = this section plays at once as the page opens: the page's `hold` does not apply to it (the sections that make the opening itself, such as a menu or a hero, as opposed to the content that waits for it). */
  immediate?: boolean;
}

export interface PageConfig {
  id: string;
  title: string;
  /** The width (px) the page lays out at, zoomed to fit the lab; absent = 400, a column of cards. */
  width?: number;
  /** How long the sections that play as the page opens wait first (a duration or delay token, or a time such as "2500ms"), so something that is not a section
   *  (a background pattern that fades away) can show before the page fades in. Sections that play later, on scroll, do not wait. Absent = no wait. */
  hold?: string;
  /** true = the page cannot be scrolled while it opens: from the start until the sections that play as it opens have finished, so content below that waits for scroll is not revealed early. Absent = scrollable throughout. */
  lockScroll?: boolean;
  components: PageComponent[];
}

// Page slot (a component id on the page) → version id of that slot's component.
export interface MotionMap {
  [componentId: string]: string;
}

export interface DtcgToken {
  $type: string;
  $value: unknown;
  $description?: string;
  $extensions?: Record<string, unknown>;
}

export interface DtcgGroup {
  [key: string]: DtcgToken | DtcgGroup;
}
