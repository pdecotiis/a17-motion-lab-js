import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scaleValues, scaleKind, remapReferences, formatTokenFile } from '../../scripts/scale-tokens.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import type { DtcgGroup } from '../../lab/lib/types.js';

const file = readFileSync(join(process.cwd(), 'tokens/motion.json'), 'utf8');
const tokens = JSON.parse(file) as Record<string, unknown>;

describe('scaleValues', () => {
  it('fibonacci is base × 1, 2, 3, 5, 8, …', () => {
    expect(scaleValues('fibonacci', 100, 6)).toEqual([100, 200, 300, 500, 800, 1300]);
    expect(scaleValues('fibonacci', 4, 5)).toEqual([4, 8, 12, 20, 32]);
  });

  it('a ratio is base × ratio^i, rounded', () => {
    expect(scaleValues(1.4, 100, 5)).toEqual([100, 140, 196, 274, 384]);
    expect(scaleValues(2, 4, 4)).toEqual([4, 8, 16, 32]);
  });

  it('rejects a ratio of 1 or less, and steps that round to the same value', () => {
    expect(() => scaleValues(1, 100, 4)).toThrow('above 1');
    expect(() => scaleValues(0.5, 100, 4)).toThrow('above 1');
    expect(() => scaleValues(1.1, 2, 4)).toThrow('both round to');
  });

  it('rejects a bad base or step count', () => {
    expect(() => scaleValues(1.4, 0, 4)).toThrow('base');
    expect(() => scaleValues(1.4, 100, 0)).toThrow('steps');
  });
});

describe('scaleKind', () => {
  const durations = [100, 140, 220, 300, 400, 560, 800, 1200];

  it('rewrites the kind with value-named tokens, in the right unit and type', () => {
    const { tokens: next } = scaleKind(tokens, 'duration', scaleValues('fibonacci', 100, 4));
    const group = next['duration'] as Record<string, { $type: string; $value: string }>;
    expect(Object.keys(group)).toEqual(['100', '200', '300', '500']);
    expect(group['300']).toMatchObject({ $type: 'duration', $value: '300ms' });
    const { tokens: dist } = scaleKind(tokens, 'distance', scaleValues(2, 4, 3));
    expect((dist['distance'] as Record<string, { $type: string; $value: string }>)['8']).toMatchObject({ $type: 'dimension', $value: '8px' });
  });

  it('leaves every other kind alone', () => {
    const { tokens: next } = scaleKind(tokens, 'duration', scaleValues(1.4, 100, 8));
    for (const kind of Object.keys(tokens).filter(k => k !== 'duration')) expect(next[kind]).toEqual(tokens[kind]);
  });

  it('maps each old step to the new one in the same position', () => {
    const { renames } = scaleKind(tokens, 'duration', scaleValues(1.4, 100, 8));
    expect(renames['duration.100']).toBe('duration.100');
    expect(renames['duration.140']).toBe('duration.140');
    expect(renames['duration.220']).toBe('duration.196');
    expect(renames['duration.1200']).toBe('duration.1054');
  });

  it('a renamed token keeps its status and notes, and records the old name', () => {
    const withNote = structuredClone(tokens) as Record<string, Record<string, { $description?: string }>>;
    withNote['duration']!['220']!.$description = 'Medium';
    const { tokens: next } = scaleKind(withNote, 'duration', scaleValues(1.4, 100, 8));
    const step = (next['duration'] as Record<string, { $description?: string; $extensions: { status: string; oldNames?: string[] } }>)['196']!;
    expect(step.$description).toBe('Medium');
    expect(step.$extensions).toEqual({ status: 'system', oldNames: ['220'] });
  });

  it('a token whose name did not change records no old name', () => {
    const { tokens: next } = scaleKind(tokens, 'duration', scaleValues(1.4, 100, 8));
    expect((next['duration'] as Record<string, { $extensions: { oldNames?: string[] } }>)['100']!.$extensions.oldNames).toBeUndefined();
  });

  it('new steps beyond the old ones start experimental', () => {
    const { tokens: next } = scaleKind(tokens, 'duration', scaleValues(1.4, 100, 10));
    const group = next['duration'] as Record<string, { $extensions: { status: string } }>;
    const names = Object.keys(group);
    expect(group[names[7]!]!.$extensions.status).toBe('system');
    expect(group[names[8]!]!.$extensions.status).toBe('experimental');
    expect(group[names[9]!]!.$extensions.status).toBe('experimental');
  });

  it('fewer steps fold the leftover old steps into the last, which keeps the highest status', () => {
    const mixed = structuredClone(tokens) as Record<string, Record<string, { $extensions: { status: string } }>>;
    for (const n of durations) mixed['duration']![String(n)]!.$extensions.status = 'experimental';
    mixed['duration']!['800']!.$extensions.status = 'system';
    const { tokens: next, renames } = scaleKind(mixed, 'duration', scaleValues(2, 100, 5));
    const group = next['duration'] as Record<string, { $extensions: { status: string; oldNames?: string[] } }>;
    expect(Object.keys(group)).toEqual(['100', '200', '400', '800', '1600']);
    expect(group['1600']!.$extensions.status).toBe('system');
    expect(group['1600']!.$extensions.oldNames).toEqual(['400', '560', '800', '1200']);
    expect(group['200']!.$extensions.status).toBe('experimental');
    expect(renames['duration.1200']).toBe('duration.1600');
    expect(renames['duration.560']).toBe('duration.1600');
  });

  it('the result still compiles', () => {
    const { tokens: next } = scaleKind(tokens, 'distance', scaleValues('fibonacci', 4, 8));
    expect(() => compileTokens(next as unknown as DtcgGroup)).not.toThrow();
  });

  it('throws for a kind with no group', () => {
    expect(() => scaleKind({}, 'delay', [40, 70])).toThrow('no "delay" group');
  });
});

describe('remapReferences', () => {
  const renames = { 'duration.300': 'duration.360', 'duration.360': 'duration.400', 'distance.16': 'distance.20' };

  it('renames whole references in a version file', () => {
    expect(remapReferences("duration: 'duration.300', stagger: 'delay.70'", renames)).toBe("duration: 'duration.360', stagger: 'delay.70'");
    expect(remapReferences("transform: 'translateY(-{distance.16})'", renames)).toBe("transform: 'translateY(-{distance.20})'");
  });

  it('renames in a single pass, so a new name is never renamed again', () => {
    expect(remapReferences("'duration.300' 'duration.360'", renames)).toBe("'duration.360' 'duration.400'");
  });

  it('leaves longer names and names inside other words alone', () => {
    expect(remapReferences("'duration.3000' 'my-duration.300' 'duration.300x'", renames)).toBe("'duration.3000' 'my-duration.300' 'duration.300x'");
  });

  it('does nothing without renames', () => {
    expect(remapReferences('anything', {})).toBe('anything');
  });
});

describe('formatTokenFile', () => {
  it('reproduces tokens/motion.json exactly, so a regenerated file diffs cleanly', () => {
    expect(formatTokenFile(tokens)).toBe(file);
  });

  it('puts one token on each line', () => {
    expect(formatTokenFile({ duration: { '100': { $type: 'duration', $value: '100ms', $extensions: { status: 'system' } } } }))
      .toBe('{\n  "duration": {\n    "100": { "$type": "duration", "$value": "100ms", "$extensions": { "status": "system" } }\n  }\n}\n');
  });
});
