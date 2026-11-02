// Bounce: the number a spring bounces with, from a token or a plain number. In its own file so the
// modules that need it (motion arguments, interactions, validation) don't import each other in a ring.

// The global bounce setting a motion uses when it names none: Motion's own default.
export const DEFAULT_BOUNCE = 'bounce.25';

// A bounce as a number from 0 to 1: a token path ("bounce.50") resolves through the tokens, a number
// is used as it is. An unknown token, or a value outside 0 to 1, throws.
export function resolveBounce(value: string | number, raw: Record<string, unknown>): number {
  const v = typeof value === 'string' ? raw[value] : value;
  if (typeof v !== 'number') throw new Error(`Unknown bounce token: "${String(value)}"`);
  if (v < 0 || v > 1) throw new Error(`Bounce "${String(value)}" must be from 0 to 1`);
  return v;
}
