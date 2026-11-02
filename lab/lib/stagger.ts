// Stagger at the page level: the delay between one component and the next as a page plays. It is a
// delay token (`delay.70`), never a free number, and there is a default setting like the global
// bounce: `delay.70` until another delay token is chosen.

export const DEFAULT_STAGGER = 'delay.70';

// How a page picks its stagger: the default setting, none at all, or one delay token.
export const PAGE_STAGGER_DEFAULT = 'default';
export const PAGE_STAGGER_NONE = 'none';

// The delay tokens, smallest first: the choices for a stagger.
export function delayTokenPaths(raw: Record<string, unknown>): string[] {
  const ms = (k: string): number => parseFloat(String(raw[k]));
  return Object.keys(raw).filter(k => k.startsWith('delay.')).sort((a, b) => ms(a) - ms(b));
}

// A URL value (`70`) as a delay token path (`delay.70`), when it names one; otherwise `fallback`.
export function staggerFromParam(value: string | null | undefined, tokens: string[], fallback: string): string {
  const path = value ? `delay.${value}` : '';
  return tokens.includes(path) ? path : fallback;
}

// The token a page staggers with, or null for none: its own choice, else the default setting.
export function pageStaggerToken(choice: string | null | undefined, tokens: string[], defaultToken: string): string | null {
  if (choice === PAGE_STAGGER_NONE) return null;
  const path = choice ? `delay.${choice}` : '';
  return tokens.includes(path) ? path : defaultToken;
}
