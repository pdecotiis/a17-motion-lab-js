import type { MotionMap } from './types.js';

export function encodeMotionMap(map: MotionMap): string {
  return btoa(JSON.stringify(map));
}

export function decodeMotionMap(encoded: string): MotionMap {
  try {
    const decoded = atob(encoded);
    const parsed = JSON.parse(decoded) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const result: MotionMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') result[k] = v;
    }
    return result;
  } catch {
    return {};
  }
}

export function getMotionMapFromUrl(): MotionMap {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('mm');
  if (!encoded) return {};
  return decodeMotionMap(encoded);
}

export function setMotionMapInUrl(map: MotionMap): void {
  const params = new URLSearchParams(window.location.search);
  if (Object.keys(map).length === 0) {
    params.delete('mm');
  } else {
    params.set('mm', encodeMotionMap(map));
  }
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
}
