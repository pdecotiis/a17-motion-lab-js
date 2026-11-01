export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// The longest a reduced-motion fade runs. Tweens, springs and the exported CSS all use it,
// so what the lab shows matches what the spec tells a developer to ship.
export const REDUCED_MOTION_FADE_MS = 150;

export function getEffectiveDuration(durationMs: number): number {
  return prefersReducedMotion() ? Math.min(durationMs, REDUCED_MOTION_FADE_MS) : durationMs;
}

export function getEffectiveKeyframes(keyframes: Keyframe[], reducedMotion: boolean): Keyframe[] {
  if (!reducedMotion) return keyframes;
  return keyframes.map(kf => {
    const reduced: Keyframe = {};
    if ('offset' in kf) reduced.offset = kf.offset;
    if ('opacity' in kf) reduced.opacity = kf.opacity;
    if (!('opacity' in kf)) reduced.opacity = 1;
    return reduced;
  });
}
