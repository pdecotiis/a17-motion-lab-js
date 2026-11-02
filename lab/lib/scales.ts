// The global scale: how the values of the distance, duration, delay, opacity and scale tokens are
// calculated.
// A scale is a ratio taken from typography (a major third is 5:4, the golden ratio is 1.618) or the
// Fibonacci sequence. Pure maths, no tokens or DOM: it says which values a scale produces; the
// generator (scripts/scale-tokens.ts) is what writes them into tokens/motion.json.
//
// Tokens are named by their value, so a different scale gives different names.
//   distance, duration, delay, opacity   base × ratio^n, rounded: 4px, 5px, 6px, 8px…
//   scale                                steps around 100%: ratio^(±n/4), so 1.25 gives 95%, 89% and 106%, 112%
//
// Anchored on 4px: most projects build on a 4px unit, so distance starts at 4px. Only scales that give
// distinct whole values from that base are offered (a major second, 4, 5, 5, 6…, is not one), and a test
// holds every scale to it for every kind.

export const BASE_UNIT_PX = 4;

export type ScaleId = 'fibonacci' | 'minor-third' | 'major-third' | 'perfect-fourth' | 'golden-ratio';

export interface ScaleDef {
  id: ScaleId;
  label: string;
  /** The ratio between one step and the next. Fibonacci has none: its steps are 1, 2, 3, 5, 8… */
  ratio: number | 'fibonacci';
  note: string;
}

const GOLDEN = (1 + Math.sqrt(5)) / 2;

// A few scales that make sense, smallest ratio first. Each gives distinct whole values from a 4px base. Typographic scales are named for the musical
// interval their ratio comes from; Fibonacci is the sequence whose ratio tends to the golden one.
export const SCALES: readonly ScaleDef[] = [
  { id: 'minor-third', label: 'Minor third', ratio: 6 / 5, note: '1.2 (6:5)' },
  { id: 'major-third', label: 'Major third', ratio: 5 / 4, note: '1.25 (5:4)' },
  { id: 'perfect-fourth', label: 'Perfect fourth', ratio: 4 / 3, note: '1.333 (4:3)' },
  { id: 'golden-ratio', label: 'Golden ratio', ratio: GOLDEN, note: '1.618: wide steps' },
  { id: 'fibonacci', label: 'Fibonacci', ratio: 'fibonacci', note: '1, 2, 3, 5, 8… times the base' },
];

export function scaleDef(id: string): ScaleDef {
  const def = SCALES.find(s => s.id === id);
  if (!def) throw new Error(`Unknown scale "${id}" (use ${SCALES.map(s => s.id).join(', ')})`);
  return def;
}

// ── Steps ──────────────────────────────────────────────────────────────────

// base × the scale's multipliers, rounded; each step must be larger than the one before. `scale` is
// `'fibonacci'` or a ratio above 1.
export function scaleValues(scale: 'fibonacci' | number, base: number, steps: number): number[] {
  if (!(base > 0) || !Number.isInteger(steps) || steps < 1) throw new Error('base must be above 0 and steps a whole number');
  if (scale !== 'fibonacci' && !(scale > 1)) throw new Error('A ratio must be above 1');
  const fib = [1, 2];
  while (fib.length < steps) fib.push(fib[fib.length - 1]! + fib[fib.length - 2]!);
  const values = Array.from({ length: steps }, (_, i) => Math.round(base * (scale === 'fibonacci' ? fib[i]! : scale ** i)));
  values.forEach((v, i) => {
    if (i > 0 && v <= values[i - 1]!) throw new Error(`Steps ${i} and ${i + 1} both round to ${v}: use a larger base or ratio`);
  });
  return values;
}

// ── The four kinds a global scale sets ─────────────────────────────────────

export type GlobalScaleKind = 'distance' | 'duration' | 'delay' | 'opacity' | 'scale';
export const GLOBAL_SCALE_KINDS: readonly GlobalScaleKind[] = ['distance', 'duration', 'delay', 'opacity', 'scale'];

export interface KindOptions {
  /** The smallest step: px, ms or percent (a 4px unit for distance). Not used by `scale`, which moves around 100%. */
  base?: number;
  /** How many steps up from the base. For `scale`, how many steps below 100%. */
  steps?: number;
  /** `scale` only: how many steps above 100%. */
  up?: number;
  /** distance only: round every step to a multiple of this many px (a 4px grid, say). */
  snap?: number;
}

// Where each kind starts, and how many steps it has, unless told otherwise. The counts match the
// token file today, so changing the scale keeps the same number of tokens.
export const KIND_DEFAULTS: Record<GlobalScaleKind, Required<Omit<KindOptions, 'snap'>>> = {
  distance: { base: BASE_UNIT_PX, steps: 8, up: 0 },
  duration: { base: 100, steps: 8, up: 0 },
  delay: { base: 40, steps: 3, up: 0 },
  opacity: { base: 4, steps: 8, up: 0 },
  scale: { base: 100, steps: 8, up: 2 },
};

// One token of a derived kind, in the form the token file holds: its name (the value), its $type and
// its $value.
export interface DerivedToken {
  name: string;
  $type: 'dimension' | 'duration' | 'number';
  $value: string | number;
}

// Scale steps move in quarter-powers of the ratio: ratio^(n/4).
const SCALE_STEP_FRACTION = 4;

// Fibonacci has no ratio of its own, so `scale` (which is built from powers) uses the golden ratio
// its sequence tends to.
const powerRatio = (scale: ScaleDef): number => (scale.ratio === 'fibonacci' ? GOLDEN : scale.ratio);

function snapTo(values: number[], snap: number | undefined): number[] {
  if (!snap) return values;
  const out = values.map(v => Math.max(snap, Math.round(v / snap) * snap));
  out.forEach((v, i) => {
    if (i > 0 && v <= out[i - 1]!) throw new Error(`Steps ${i} and ${i + 1} both snap to ${v}px: use a larger base or ratio, or a smaller grid`);
  });
  return out;
}

// The tokens a scale gives a kind, smallest first. Throws when two steps round to the same value
// (the base is too small for the ratio), naming the way out. Opacity steps above 100% are dropped.
export function deriveKind(kind: GlobalScaleKind, scaleId: string, options: KindOptions = {}): DerivedToken[] {
  const scale = scaleDef(scaleId);
  const d = KIND_DEFAULTS[kind];

  if (kind === 'scale') {
    const down = options.steps ?? d.steps;
    const up = options.up ?? d.up;
    if (!Number.isInteger(down) || !Number.isInteger(up) || down < 0 || up < 0 || down + up < 1) {
      throw new Error('scale needs a whole number of steps below and above 100%');
    }
    const r = powerRatio(scale);
    const percents = [
      ...Array.from({ length: down }, (_, i) => Math.round(100 * r ** (-(i + 1) / SCALE_STEP_FRACTION))),
      ...Array.from({ length: up }, (_, i) => Math.round(100 * r ** ((i + 1) / SCALE_STEP_FRACTION))),
    ].sort((a, b) => a - b);
    percents.forEach((p, i) => {
      if (p === 100) throw new Error(`scale: a step rounds to 100%, which is no scale at all: use a larger ratio or fewer steps`);
      if (i > 0 && p === percents[i - 1]) throw new Error(`scale: two steps both round to ${p}%: use a larger ratio or fewer steps`);
    });
    return percents.map(p => ({ name: String(p), $type: 'number', $value: p / 100 }));
  }

  const base = options.base ?? d.base;
  const steps = options.steps ?? d.steps;
  let values = scaleValues(scale.ratio, base, steps);

  if (kind === 'opacity') {
    values = values.filter(v => v <= 100);
    return values.map(v => ({ name: String(v).padStart(2, '0'), $type: 'number', $value: v / 100 }));
  }
  if (kind === 'distance') {
    values = snapTo(values, options.snap);
    return values.map(v => ({ name: String(v), $type: 'dimension', $value: `${v}px` }));
  }
  // duration and delay: whole milliseconds
  return values.map(v => ({ name: String(v), $type: 'duration', $value: `${v}ms` }));
}

// Every kind a global scale sets, with each kind's own options.
export function deriveAll(
  scaleId: string,
  options: Partial<Record<GlobalScaleKind, KindOptions>> = {},
): Record<GlobalScaleKind, DerivedToken[]> {
  return Object.fromEntries(GLOBAL_SCALE_KINDS.map(k => [k, deriveKind(k, scaleId, options[k])])) as Record<GlobalScaleKind, DerivedToken[]>;
}
