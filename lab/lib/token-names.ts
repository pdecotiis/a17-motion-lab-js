// How the Tokens view (and the spec sheets it follows) name and write a token's value.
//
// A token's path is what files and Figma hold: `duration.300` is `duration/300` in the Figma collection.
// What people read is the spec sheet's form: words joined by hyphens, so `duration-300`, `distance-24`, and an
// easing without its group word, so `productive-standard`. Display only: nothing here renames a token.

export function tokenDisplayName(path: string): string {
  const dot = path.indexOf('.');
  if (dot === -1) return path;
  const group = path.slice(0, dot);
  const name = path.slice(dot + 1);
  return group === 'easing' ? name : `${group}-${name}`;
}

// The Value column's header names its unit, as the kit's duration sheet does ("Value (ms)").
export const VALUE_HEADERS: Record<string, string> = {
  duration: 'Value (ms)',
  delay: 'Value (ms)',
  distance: 'Value (px)',
  scale: 'Value (%)',
  opacity: 'Value (%)',
  easing: 'Value',
  bounce: 'Value',
};

// The kinds that show an example beside the value (a curve, a bar, a distance): a third column.
export const EXAMPLE_KINDS: readonly string[] = ['easing', 'duration', 'distance', 'bounce'];

const trim = (n: number): string => String(Math.round(n * 100) / 100);

// A value as the sheet writes it, with the unit left to the header: `300`, `16`, `95`, `0.2, 0, 0.38, 0.9`.
export function tokenValueText(kind: string, value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (kind === 'scale' || kind === 'opacity') return trim(Number(value) * 100);
  if (typeof value === 'number') return trim(value);
  const n = parseFloat(String(value));
  return Number.isNaN(n) ? String(value) : trim(n);
}
