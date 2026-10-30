// Live controls (duration, easing, delay) offer the system's tokens first.
// Anything else goes through an explicit "Custom…" choice.

export type TokenGroup = 'timings' | 'easings';

export const CUSTOM_VALUE = '__custom__';

export interface ControlOption {
  /** Token path (e.g. "motion.timings.base"); '' is "version default", CUSTOM_VALUE is "Custom…". */
  value: string;
  label: string;
}

// The CSS value of a duration or cubicBezier token, e.g. "300ms" or "cubic-bezier(0, 0, 0.2, 1)".
export function tokenCss(raw: Record<string, unknown>, path: string): string | undefined {
  const v = raw[path];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length === 4) return `cubic-bezier(${v.join(', ')})`;
  return undefined;
}

// Tokens of one group in token-file order: [{ value: path, label: "base · 300ms" }].
export function tokenOptions(raw: Record<string, unknown>, group: TokenGroup): ControlOption[] {
  const prefix = `motion.${group}.`;
  const options: ControlOption[] = [];
  for (const path of Object.keys(raw)) {
    if (!path.startsWith(prefix)) continue;
    const css = tokenCss(raw, path);
    if (css === undefined) continue;
    options.push({ value: path, label: `${path.slice(prefix.length)} · ${css}` });
  }
  return options;
}

// Delay has no tokens of its own: "none" plus the timing tokens.
export const ZERO_VALUE = '__none__';

export function delayOptions(raw: Record<string, unknown>): ControlOption[] {
  return [{ value: ZERO_VALUE, label: 'none · 0ms' }, ...tokenOptions(raw, 'timings')];
}

// What a select plus its custom field mean: '' → no override, a token → its CSS value,
// custom → the typed value (numbers get "ms" when unit is "ms"). Empty custom → no override.
export function resolveControlValue(
  raw: Record<string, unknown>,
  selected: string,
  custom: string,
  unit: 'ms' | '' = '',
): string | undefined {
  if (selected === '') return undefined;
  if (selected === ZERO_VALUE) return '0ms';
  if (selected === CUSTOM_VALUE) {
    const typed = custom.trim();
    if (!typed) return undefined;
    return unit === 'ms' && /^-?\d+(\.\d+)?$/.test(typed) ? `${typed}ms` : typed;
  }
  return tokenCss(raw, selected);
}
