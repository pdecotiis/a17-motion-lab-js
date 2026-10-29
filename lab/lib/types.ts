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

export interface MotionVersion {
  id: string;
  label: string;
  model: MotionModel;
  keyframes?: Keyframe[];  // Required for tween; unused for spring (spring uses model.properties)
  stagger?: string;
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
