import { describe, it, expect } from 'vitest';
import { encodeMotionMap, decodeMotionMap } from '../../lab/lib/motion-map.js';
import type { MotionMap } from '../../lab/lib/types.js';

describe('encodeMotionMap / decodeMotionMap', () => {
  it('round-trips a simple map', () => {
    const map: MotionMap = { 'card-1': 'v1', 'card-2': 'v2' };
    const encoded = encodeMotionMap(map);
    expect(typeof encoded).toBe('string');
    const decoded = decodeMotionMap(encoded);
    expect(decoded).toEqual(map);
  });

  it('round-trips an empty map', () => {
    const map: MotionMap = {};
    expect(decodeMotionMap(encodeMotionMap(map))).toEqual(map);
  });

  it('returns empty object for invalid base64', () => {
    expect(decodeMotionMap('!!!not-base64!!!')).toEqual({});
  });

  it('returns empty object for non-object JSON', () => {
    expect(decodeMotionMap(btoa('[1,2,3]'))).toEqual({});
  });

  it('skips non-string values', () => {
    const raw = btoa(JSON.stringify({ 'card-1': 'v1', 'card-2': 123 }));
    const decoded = decodeMotionMap(raw);
    expect(decoded['card-1']).toBe('v1');
    expect(decoded['card-2']).toBeUndefined();
  });
});
