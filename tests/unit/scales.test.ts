import { describe, it, expect } from 'vitest';
import { SCALES, scaleDef, scaleValues, deriveKind, deriveAll, KIND_DEFAULTS, GLOBAL_SCALE_KINDS, BASE_UNIT_PX } from '../../lab/lib/scales.js';

const values = (kind: Parameters<typeof deriveKind>[0], scale: string, opts = {}) => deriveKind(kind, scale, opts).map(t => t.$value);
const names = (kind: Parameters<typeof deriveKind>[0], scale: string, opts = {}) => deriveKind(kind, scale, opts).map(t => t.name);

describe('the scales', () => {
  it('are a few that make sense: four typographic ratios and Fibonacci, smallest ratio first', () => {
    expect(SCALES.map(s => s.id)).toEqual(['minor-third', 'major-third', 'perfect-fourth', 'golden-ratio', 'fibonacci']);
    const ratios = SCALES.filter(s => s.ratio !== 'fibonacci').map(s => s.ratio as number);
    expect(ratios.map(r => Math.round(r * 1000) / 1000)).toEqual([1.2, 1.25, 1.333, 1.618]);
    expect([...ratios].sort((a, b) => a - b)).toEqual(ratios);
  });

  it('are anchored on 4px, and every one gives distinct whole values for every kind from its defaults', () => {
    expect(BASE_UNIT_PX).toBe(4);
    expect(KIND_DEFAULTS.distance.base).toBe(4);
    for (const scale of SCALES) {
      for (const kind of GLOBAL_SCALE_KINDS) {
        const tokens = deriveKind(kind, scale.id);
        const v = tokens.map(t => (typeof t.$value === 'number' ? t.$value : parseFloat(t.$value)));
        expect(tokens.length, `${scale.id} ${kind}`).toBeGreaterThan(0);
        expect(new Set(v).size, `${scale.id} ${kind} repeats a value`).toBe(v.length);
        expect(v, `${scale.id} ${kind} is not smallest to largest`).toEqual([...v].sort((a, b) => a - b));
        expect(new Set(tokens.map(t => t.name)).size, `${scale.id} ${kind} repeats a name`).toBe(tokens.length);
      }
    }
  });

  it('the one that collided from 4px, the major second, is gone: it would give 4, 5, 5, 6…', () => {
    expect(SCALES.some(s => (s.id as string) === 'major-second')).toBe(false);
    expect(() => scaleDef('major-second')).toThrow('Unknown scale');
    expect(() => scaleValues(9 / 8, 4, 8)).toThrow('both round to');
  });

  it('scaleDef finds one by id, and an unknown id names the choices', () => {
    expect(scaleDef('major-third').label).toBe('Major third');
    expect(() => scaleDef('lydian')).toThrow('Unknown scale "lydian" (use minor-third, major-third');
  });

  it('every scale has a label and a note', () => {
    for (const s of SCALES) { expect(s.label).not.toBe(''); expect(s.note).not.toBe(''); }
  });
});

describe('scaleValues', () => {
  it('Fibonacci is base × 1, 2, 3, 5, 8…', () => {
    expect(scaleValues('fibonacci', 4, 8)).toEqual([4, 8, 12, 20, 32, 52, 84, 136]);
  });

  it('a ratio is base × ratio^n, rounded', () => {
    expect(scaleValues(1.25, 4, 8)).toEqual([4, 5, 6, 8, 10, 12, 15, 19]);
  });

  it('throws when two steps round to the same value, or the input is wrong', () => {
    expect(() => scaleValues(9 / 8, 4, 8)).toThrow('both round to');
    expect(() => scaleValues(1, 4, 4)).toThrow('above 1');
    expect(() => scaleValues('fibonacci', 0, 4)).toThrow('base must be above 0');
  });
});

describe('distance', () => {
  it('is px from a 4px base, 8 steps, named by value', () => {
    expect(deriveKind('distance', 'major-third')[0]).toEqual({ name: '4', $type: 'dimension', $value: '4px' });
    expect(values('distance', 'major-third')).toEqual(['4px', '5px', '6px', '8px', '10px', '12px', '15px', '19px']);
    expect(names('distance', 'fibonacci')).toEqual(['4', '8', '12', '20', '32', '52', '84', '136']);
  });

  it('the golden ratio gives wide steps and the minor third gives close ones', () => {
    expect(values('distance', 'golden-ratio')).toEqual(['4px', '6px', '10px', '17px', '27px', '44px', '72px', '116px']);
    expect(values('distance', 'minor-third')).toEqual(['4px', '5px', '6px', '7px', '8px', '10px', '12px', '14px']);
  });

  it('takes its own base and number of steps', () => {
    expect(values('distance', 'minor-third', { base: 16, steps: 4 })).toEqual(['16px', '19px', '23px', '28px']);
  });

  it('snaps to a grid: a 4px grid keeps every step a multiple of 4', () => {
    const snapped = values('distance', 'perfect-fourth', { base: 8, steps: 5, snap: 4 });
    expect(snapped).toEqual(['8px', '12px', '16px', '20px', '24px']);
    for (const v of snapped) expect(parseInt(String(v), 10) % 4).toBe(0);
  });

  it('says so when a base is too small for a ratio, naming the way out', () => {
    expect(() => deriveKind('distance', 'minor-third', { base: 1 })).toThrow('use a larger base or ratio');
    expect(() => deriveKind('distance', 'major-third', { snap: 8 })).toThrow('snap to');
  });
});

describe('duration', () => {
  it('is ms from a 100ms base, 8 steps, named by value', () => {
    expect(deriveKind('duration', 'fibonacci')[0]).toEqual({ name: '100', $type: 'duration', $value: '100ms' });
    expect(values('duration', 'fibonacci')).toEqual(['100ms', '200ms', '300ms', '500ms', '800ms', '1300ms', '2100ms', '3400ms']);
    expect(values('duration', 'major-third')).toEqual(['100ms', '125ms', '156ms', '195ms', '244ms', '305ms', '381ms', '477ms']);
    expect(values('duration', 'perfect-fourth', { steps: 4 })).toEqual(['100ms', '133ms', '178ms', '237ms']);
  });

  it('takes its own base and number of steps', () => {
    expect(values('duration', 'golden-ratio', { base: 140, steps: 3 })).toEqual(['140ms', '227ms', '367ms']);
  });
});

describe('delay', () => {
  it('is ms from a 40ms base, 3 steps', () => {
    expect(values('delay', 'fibonacci')).toEqual(['40ms', '80ms', '120ms']);
    expect(values('delay', 'major-third')).toEqual(['40ms', '50ms', '63ms']);
    expect(values('delay', 'golden-ratio')).toEqual(['40ms', '65ms', '105ms']);
    expect(deriveKind('delay', 'fibonacci')[0]).toEqual({ name: '40', $type: 'duration', $value: '40ms' });
  });
});

describe('opacity', () => {
  it('is a fraction of 1, named by its percent padded to two digits', () => {
    expect(deriveKind('opacity', 'major-third')[0]).toEqual({ name: '04', $type: 'number', $value: 0.04 });
    expect(names('opacity', 'major-third')).toEqual(['04', '05', '06', '08', '10', '12', '15', '19']);
    expect(values('opacity', 'major-third', { steps: 3 })).toEqual([0.04, 0.05, 0.06]);
  });

  it('drops steps above 100%: Fibonacci from 4% stops at 84%', () => {
    expect(values('opacity', 'fibonacci')).toEqual([0.04, 0.08, 0.12, 0.2, 0.32, 0.52, 0.84]);
    for (const v of values('opacity', 'golden-ratio', { base: 10, steps: 8 })) expect(v as number).toBeLessThanOrEqual(1);
  });
});

describe('scale', () => {
  it('moves around 100% in quarter-powers of the ratio, named by percent', () => {
    expect(names('scale', 'major-third', { steps: 3, up: 2 })).toEqual(['85', '89', '95', '106', '112']);
    expect(values('scale', 'major-third', { steps: 3, up: 2 })).toEqual([0.85, 0.89, 0.95, 1.06, 1.12]);
  });

  it('the golden ratio moves further per step', () => {
    expect(values('scale', 'golden-ratio', { steps: 2, up: 1 })).toEqual([0.79, 0.89, 1.13]);
  });

  it('Fibonacci uses the golden ratio its sequence tends to', () => {
    expect(values('scale', 'fibonacci', { steps: 2, up: 1 })).toEqual(values('scale', 'golden-ratio', { steps: 2, up: 1 }));
  });

  it('is sorted smallest to largest, has no 100%, and is a plain number type', () => {
    const t = deriveKind('scale', 'perfect-fourth');
    expect(t.map(x => x.$value as number)).toEqual([...t.map(x => x.$value as number)].sort((a, b) => a - b));
    expect(t.some(x => x.$value === 1)).toBe(false);
    expect(t.every(x => x.$type === 'number')).toBe(true);
  });

  it('defaults to 8 steps below and 2 above, like the token file', () => {
    expect(KIND_DEFAULTS.scale).toMatchObject({ steps: 8, up: 2 });
    expect(deriveKind('scale', 'perfect-fourth')).toHaveLength(10);
  });

  it('says so when steps collapse onto each other or onto 100%', () => {
    expect(() => deriveKind('scale', 'minor-third', { steps: 8, up: 2 })).not.toThrow();
    expect(() => deriveKind('scale', 'minor-third', { steps: 0, up: 0 })).toThrow('whole number of steps');
  });
});

describe('deriveAll', () => {
  it('derives the four kinds from one scale', () => {
    expect(GLOBAL_SCALE_KINDS).toEqual(['distance', 'duration', 'delay', 'opacity', 'scale']);
    const all = deriveAll('perfect-fourth', { distance: { base: 8, steps: 5 } });
    expect(Object.keys(all)).toEqual(['distance', 'duration', 'delay', 'opacity', 'scale']);
    expect(all.distance.map(t => t.name)).toEqual(['8', '11', '14', '19', '25']);
    expect(all.delay).toHaveLength(3);
  });

  it('an unknown scale throws', () => {
    expect(() => deriveAll('lydian')).toThrow('Unknown scale');
  });
});
