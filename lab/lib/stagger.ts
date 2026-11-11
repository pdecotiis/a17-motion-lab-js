// Stagger at the page level: the delay between one component and the next as a page plays. It is a
// delay token (`delay.80`), never a free number, and there is a default setting like the global
// bounce. The default is not a name: it is the middle one of the project's delay tokens until another is chosen,
// so a project that tweaks its delay tokens needs no change here.

// How a page picks its stagger: the default setting, none at all, or one delay token.
export const PAGE_STAGGER_DEFAULT = 'default';
export const PAGE_STAGGER_NONE = 'none';

// The delay tokens, smallest first: the choices for a stagger.
export function delayTokenPaths(raw: Record<string, unknown>): string[] {
  const ms = (k: string): number => parseFloat(String(raw[k]));
  return Object.keys(raw).filter(k => k.startsWith('delay.')).sort((a, b) => ms(a) - ms(b));
}

// The default stagger: the middle delay token (the lower middle of an even number), from the tokens smallest first.
export function defaultStaggerOf(tokens: string[]): string {
  if (tokens.length === 0) throw new Error('There are no delay tokens: a page needs one to stagger its components');
  return tokens[Math.floor((tokens.length - 1) / 2)]!;
}

// A URL value (`80`) as a delay token path (`delay.80`), when it names one; otherwise `fallback`.
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

// How long the sections that play as a page opens wait first, in ms: a token path or a time such as "2500ms"; 0 when the page has none.
export function pageHoldMs(hold: string | undefined, raw: Record<string, unknown>): number {
  if (hold === undefined || hold === '') return 0;
  const text = String(hold in raw ? raw[hold] : hold);
  const ms = text.endsWith('ms') ? parseFloat(text) : text.endsWith('s') ? parseFloat(text) * 1000 : parseFloat(text);
  if (!(ms >= 0)) throw new Error(`A page's hold must be a duration or delay token, or a time such as "2500ms": "${hold}"`);
  return ms;
}
