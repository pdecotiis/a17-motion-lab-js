import type { ComponentModule, ComponentStatus, MotionVersion, TriggerType, MotionTrigger, ReducedMotionPolicy } from './types.js';

export const COMPONENT_STATUSES: readonly ComponentStatus[] = ['in-progress', 'review', 'approved', 'archived'];

export const STATUS_LABELS: Record<ComponentStatus, string> = {
  'in-progress': 'In progress',
  review: 'Review',
  approved: 'Approved',
  archived: 'Archived',
};

export function isComponentStatus(value: unknown): value is ComponentStatus {
  return typeof value === 'string' && (COMPONENT_STATUSES as readonly string[]).includes(value);
}

// A component with no stored status counts as in-progress.
export function getComponentStatus(module: Pick<ComponentModule, 'status'>): ComponentStatus {
  return module.status ?? 'in-progress';
}

// Per-component check: a valid component status, and every version has lineage
// (forkedFrom a sibling version, or an "imported from <source>" string).
export function validateVersionMeta(versions: MotionVersion[], status?: unknown): void {
  if (status !== undefined && !isComponentStatus(status)) {
    throw new Error(`Component has unknown status "${String(status)}"`);
  }
  const ids = new Set(versions.map(v => v.id));
  for (const v of versions) {
    if (v.forkedFrom === undefined && !v.lineage) {
      throw new Error(`Version "${v.id}" needs lineage: set forkedFrom to its parent version or lineage to "imported from <source>"`);
    }
    if (v.forkedFrom !== undefined) {
      if (v.forkedFrom === v.id) throw new Error(`Version "${v.id}" cannot be forked from itself`);
      if (!ids.has(v.forkedFrom)) {
        throw new Error(`Version "${v.id}" is forked from "${v.forkedFrom}", which does not exist`);
      }
    }
  }
}

// A new version has lineage pointing at the parent.
export function forkVersion(parent: MotionVersion, id: string, label: string): MotionVersion {
  const fork: MotionVersion = { ...structuredClone(parent), id, label, forkedFrom: parent.id };
  delete fork.lineage;
  delete fork.reviewNotes;
  return fork;
}

// The library's filter: components by status.
export interface ComponentFilter {
  status?: ComponentStatus | 'all';
  showArchived?: boolean;
}

// Archived components are hidden unless showArchived is set or status === 'archived'.
export function componentPasses(module: Pick<ComponentModule, 'status'>, filter: ComponentFilter = {}): boolean {
  const { status = 'all', showArchived = false } = filter;
  const s = getComponentStatus(module);
  if (status !== 'all') return s === status;
  return showArchived || s !== 'archived';
}

export function describeLineage(version: MotionVersion, siblings: MotionVersion[]): string {
  if (version.forkedFrom !== undefined) {
    const parent = siblings.find(v => v.id === version.forkedFrom);
    return `Forked from ${version.forkedFrom}${parent ? `: ${parent.label}` : ''}`;
  }
  if (version.lineage) {
    return version.lineage.charAt(0).toUpperCase() + version.lineage.slice(1);
  }
  return 'No lineage recorded';
}

// Parse the status/archived URL params used by the library.
export function filterFromParams(params: URLSearchParams): ComponentFilter {
  const raw = params.get('status');
  return {
    status: isComponentStatus(raw) ? raw : 'all',
    showArchived: params.get('archived') === '1',
  };
}

export const TRIGGER_TYPES: readonly TriggerType[] = ['load', 'in-view', 'hover', 'click', 'route-change'];

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  load: 'On page load',
  'in-view': 'When scrolled into view',
  hover: 'On hover',
  click: 'On click',
  'route-change': 'On route change',
};

export function isTriggerType(value: unknown): value is TriggerType {
  return typeof value === 'string' && (TRIGGER_TYPES as readonly string[]).includes(value);
}

// Human-readable trigger, or null when the version doesn't specify one.
export function describeTrigger(trigger: MotionTrigger | undefined): string | null {
  if (!trigger) return null;
  const details: string[] = [];
  if (trigger.on === 'in-view' && trigger.threshold !== undefined) {
    details.push(`${Math.round(trigger.threshold * 100)}% visible`);
  }
  if (trigger.once !== undefined) details.push(trigger.once ? 'first time only' : 'every time');
  if (trigger.each) details.push('each element as it appears');
  const label = TRIGGER_LABELS[trigger.on];
  return details.length ? `${label} (${details.join(', ')})` : label;
}

export const REDUCED_MOTION_POLICIES: readonly ReducedMotionPolicy[] = ['fade', 'none'];

export const REDUCED_MOTION_LABELS: Record<ReducedMotionPolicy, string> = {
  fade: 'Fade only, no movement',
  none: 'No animation',
};

export function isReducedMotionPolicy(value: unknown): value is ReducedMotionPolicy {
  return typeof value === 'string' && (REDUCED_MOTION_POLICIES as readonly string[]).includes(value);
}

// A version with no stored policy fades.
export function getReducedMotionPolicy(version: MotionVersion): ReducedMotionPolicy {
  return version.reducedMotion ?? 'fade';
}
