export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getEffectiveDuration(durationMs: number): number {
  return prefersReducedMotion() ? 0 : durationMs;
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
