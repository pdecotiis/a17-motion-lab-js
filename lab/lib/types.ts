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

// A spring names the same primitives as a tween, a duration and an easing, plus its own bounce
// (0 = no bounce, 1 = very bouncy; a plain number, not a token). Only a runtime with real springs
// plays it as one (Motion, with the duration as its visual duration); the lab never simulates a
// spring itself. Anywhere else (CSS) it plays its from/to values with the easing curve over the
// duration.
export type SpringModel = {
  model: 'spring';
  duration: string;
  easing: string;
  bounce: number;
  delay?: string;
  properties: SpringProperty[];
};

export type MotionModel = TweenModel | SpringModel;

export type VersionStatus = 'in-progress' | 'review' | 'approved' | 'archived';

// What makes the motion play in production. The lab plays on demand, so this is a spec for the
// developer, not something the lab simulates.
export type TriggerType = 'load' | 'in-view' | 'hover' | 'click' | 'route-change';

export interface MotionTrigger {
  on: TriggerType;
  threshold?: number;  // in-view only: fraction of the element visible (0–1) that fires it
  once?: boolean;      // play the first time only (true) or every time the trigger fires (false)
}

// What a visitor with prefers-reduced-motion: reduce gets.
// 'fade': opacity-only fade (transforms and travel dropped, REDUCED_MOTION_FADE_MS at most).
// 'none': no animation, the element appears in its end state.
export type ReducedMotionPolicy = 'fade' | 'none';

// One motion: a tween or a spring, and the keyframes a tween plays.
export interface MotionStep {
  model: MotionModel;
  keyframes?: Keyframe[];  // Required for tween; unused for spring (spring uses model.properties)
}

export interface MotionVersion {
  id: string;
  label: string;
  model: MotionModel;
  keyframes?: Keyframe[];  // Required for tween; unused for spring (spring uses model.properties)
  // Motion for layers inside the component, beside the root's own (model, keyframes). The key is the
  // name of a layer, the value of its data-motion attribute (e.g. 'title'). Each layer names its own
  // duration, easing and delay, so text can move differently from the card.
  layers?: Record<string, MotionStep>;
  stagger?: string;
  trigger?: MotionTrigger;               // absent = not specified; the spec says so rather than guessing
  reducedMotion?: ReducedMotionPolicy;   // absent = 'fade'
  status?: VersionStatus;  // absent = 'in-progress'
  forkedFrom?: string;     // parent version id in the same component
  lineage?: string;        // origin when not forked, e.g. 'imported from <figma link>'
  // Future-ready
  reviewNotes?: string;
}

export interface ComponentModule {
  versions: MotionVersion[];
  defaultVersion: string;
}

export interface PageComponent {
  id: string;
  component: string;
  layout?: string;
}

export interface PageConfig {
  id: string;
  title: string;
  components: PageComponent[];
}

export interface MotionMap {
  [componentId: string]: string;
}

export interface Preset {
  id: string;
  label: string;
  motionMap: MotionMap;
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
