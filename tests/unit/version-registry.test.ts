import { describe, it, expect, beforeEach } from 'vitest';
import { registerComponent, getVersion, getDefaultVersion } from '../../lab/lib/version-registry.js';
import type { ComponentModule, MotionVersion } from '../../lab/lib/types.js';

const mockV1: MotionVersion = {
  id: 'v1',
  label: 'V1',
  model: { model: 'tween', duration: '300ms', easing: 'ease-out' },
  keyframes: [{ opacity: 0 }, { opacity: 1 }],
};
const mockV2: MotionVersion = {
  id: 'v2',
  label: 'V2',
  model: {
    model: 'spring',
    bounce: 0.4,
    duration: '600ms',
    properties: [
      { property: 'transform', wrapTransform: 'scale', from: 0.9, to: 1, span: 1, useSpring: true },
    ],
  },
};
const mockModule: ComponentModule = { versions: [mockV1, mockV2], defaultVersion: 'v1' };

describe('version-registry', () => {
  beforeEach(() => {
    registerComponent('test-comp', mockModule);
  });

  it('looks up v1 by id', () => {
    const v = getVersion('test-comp', 'v1');
    expect(v.id).toBe('v1');
    expect(v.label).toBe('V1');
  });

  it('looks up v2 by id', () => {
    const v = getVersion('test-comp', 'v2');
    expect(v.id).toBe('v2');
  });

  it('falls back to default for unknown version', () => {
    const v = getVersion('test-comp', 'v99');
    expect(v.id).toBe('v1');
  });

  it('getDefaultVersion returns the default', () => {
    const v = getDefaultVersion('test-comp');
    expect(v.id).toBe('v1');
  });

  it('throws for unknown component', () => {
    expect(() => getVersion('does-not-exist', 'v1')).toThrow('Unknown component');
  });
});
