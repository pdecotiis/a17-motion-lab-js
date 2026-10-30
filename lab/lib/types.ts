export type TweenModel = {
  model: 'tween';
  duration: string;
  easing: string;
  delay?: string;
};

// One property animated by the spring engine.
// property: CSS property name ('opacity', 'transform').
// wrapTransform: wraps value in a transform function, e.g. 'scale' → 'scale(0.94)'.
// unit: appended to the numeric value, e.g. 'px', '%'; default ''.
// span: isSettled threshold — 20 for pixels, 1 for unitless (opacity, scale).
// useSpring: false = linear interpolation (good for opacity alongside a spring transform).
export interface SpringProperty {
  property: string;
  from: number;
  to: number;
  unit?: string;
  wrapTransform?: string;
  span?: number;
  useSpring?: boolean;
}

export type SpringModel = {
  model: 'spring';
  bounce: number;
  duration: string;  // token path (e.g. 'motion.springs.bouncy') or literal ('600ms')
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

export interface MotionVersion {
  id: string;
  label: string;
  model: MotionModel;
  keyframes?: Keyframe[];  // Required for tween; unused for spring (spring uses model.properties)
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
}

export interface DtcgGroup {
  [key: string]: DtcgToken | DtcgGroup;
}

export interface LiveControls {
  duration?: string;
  easing?: string;
  delay?: string;
}
