import type { Preset, MotionMap } from './types.js';

export function validatePreset(data: unknown): Preset {
  if (typeof data !== 'object' || data === null) throw new Error('Preset must be an object');
  const p = data as Record<string, unknown>;
  if (typeof p['id'] !== 'string' || !p['id']) throw new Error('Preset missing required field: id');
  if (typeof p['label'] !== 'string' || !p['label']) throw new Error('Preset missing required field: label');
  if (typeof p['motionMap'] !== 'object' || p['motionMap'] === null)
    throw new Error('Preset missing required field: motionMap');
  const mm = p['motionMap'] as Record<string, unknown>;
  const motionMap: MotionMap = {};
  for (const [k, v] of Object.entries(mm)) {
    if (typeof v !== 'string') throw new Error(`Preset motionMap entry "${k}" must be a string`);
    motionMap[k] = v;
  }
  return { id: p['id'] as string, label: p['label'] as string, motionMap };
}

export function serializePreset(preset: Preset): string {
  return JSON.stringify(preset, null, 2);
}
