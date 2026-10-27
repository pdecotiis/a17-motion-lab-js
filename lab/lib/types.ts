export type TweenModel = {
  model: 'tween';
  duration: string;
  easing: string;
  delay?: string;
};

export type SpringModel = {
  model: 'spring';
  bounce: number;
  duration: string;
  delay?: string;
};

export type MotionModel = TweenModel | SpringModel;

export interface MotionVersion {
  id: string;
  label: string;
  model: MotionModel;
  keyframes: Keyframe[];
  stagger?: string;
  // Future-ready
  status?: 'in-progress' | 'review' | 'approved' | 'archived';
  reviewNotes?: string;
  forkedFrom?: string;
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
