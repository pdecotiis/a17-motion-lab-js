import { describe, it, expect } from 'vitest';
import { validatePreset, serializePreset } from '../../lab/lib/presets.js';

describe('validatePreset', () => {
  it('accepts a valid preset', () => {
    const p = validatePreset({ id: 'default', label: 'Default', motionMap: { 'card-1': 'v1' } });
    expect(p.id).toBe('default');
    expect(p.label).toBe('Default');
    expect(p.motionMap['card-1']).toBe('v1');
  });

  it('throws on missing id', () => {
    expect(() => validatePreset({ label: 'X', motionMap: {} })).toThrow('id');
  });

  it('throws on missing label', () => {
    expect(() => validatePreset({ id: 'x', motionMap: {} })).toThrow('label');
  });

  it('throws on missing motionMap', () => {
    expect(() => validatePreset({ id: 'x', label: 'X' })).toThrow('motionMap');
  });

  it('throws on non-object input', () => {
    expect(() => validatePreset('string')).toThrow('object');
  });

  it('throws on non-string motionMap value', () => {
    expect(() => validatePreset({ id: 'x', label: 'X', motionMap: { 'card-1': 123 } })).toThrow('string');
  });
});

describe('serializePreset', () => {
  it('produces valid JSON', () => {
    const p = validatePreset({ id: 'default', label: 'Default', motionMap: {} });
    const json = serializePreset(p);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json).id).toBe('default');
  });
});
