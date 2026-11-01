import type { DtcgToken, DtcgGroup, SpringForm, TokenMeta, TokenStatus } from './types.js';

export interface CompiledTokens {
  cssVars: Record<string, string>;
  /**
   * Token values by path. An easing token that has a spring form also has `<path>.spring`
   * (a SpringForm), a view of the easing, not a token in the file. See springKey.
   */
  raw: Record<string, unknown>;
  /** Notes, status and old names by token path. */
  meta: Record<string, TokenMeta>;
}

export const TOKEN_STATUSES: readonly TokenStatus[] = ['system', 'experimental'];

// The CSS custom property a token path compiles to, e.g. 'duration.300' → '--motion-duration-300'.
// Token paths carry no "motion" root: the token file is the namespace, as a collection is in Figma
// (easing/productive-standard). The CSS variable keeps the prefix so it can't collide with others.
export function tokenVarName(path: string): string {
  return `--motion-${path.replace(/\./g, '-')}`;
}

// Where an easing's spring form lives in `raw`: 'easing.expressive-settle' → 'easing.expressive-settle.spring'.
export function springKey(easingPath: string): string {
  return `${easingPath}.spring`;
}

export function isSpringForm(v: unknown): v is SpringForm {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    && typeof (v as SpringForm).bounce === 'number' && typeof (v as SpringForm).token === 'string';
}

// A token waiting for the bounce token its spring form refers to.
interface PendingSpring {
  path: string;
  bounce: unknown;
}

function isDtcgToken(v: unknown): v is DtcgToken {
  return typeof v === 'object' && v !== null && '$type' in v && '$value' in v;
}

// Notes, status and old names. A token with no status is experimental, as a new token is.
function readMeta(path: string, token: DtcgToken): TokenMeta {
  const ext = token.$extensions ?? {};
  const status = ext['status'] ?? 'experimental';
  if (!(TOKEN_STATUSES as readonly unknown[]).includes(status)) {
    throw new Error(`Token ${path}: status must be "system" or "experimental", not "${String(status)}"`);
  }
  const meta: TokenMeta = { status: status as TokenStatus };
  if (typeof token.$description === 'string') meta.description = token.$description;
  const oldNames = ext['oldNames'];
  if (oldNames !== undefined) {
    if (!Array.isArray(oldNames) || oldNames.some(n => typeof n !== 'string')) {
      throw new Error(`Token ${path}: oldNames must be a list of names`);
    }
    meta.oldNames = oldNames as string[];
  }
  return meta;
}

function flattenGroup(
  group: DtcgGroup,
  prefix: string,
  cssVars: Record<string, string>,
  raw: Record<string, unknown>,
  meta: Record<string, TokenMeta>,
  springs: PendingSpring[],
): void {
  for (const [key, value] of Object.entries(group)) {
    if (key.startsWith('$')) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isDtcgToken(value)) {
      raw[fullKey] = value.$value;
      meta[fullKey] = readMeta(fullKey, value);
      const cssKey = tokenVarName(fullKey);
      switch (value.$type) {
        case 'duration':
          if (typeof value.$value !== 'string')
            throw new Error(`Token ${fullKey}: duration $value must be a string`);
          cssVars[cssKey] = value.$value;
          break;
        case 'cubicBezier': {
          if (!Array.isArray(value.$value) || value.$value.length !== 4)
            throw new Error(`Token ${fullKey}: cubicBezier $value must be array of 4 numbers`);
          const [x1, y1, x2, y2] = value.$value as number[];
          cssVars[cssKey] = `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
          const spring = value.$extensions?.['spring'] as { bounce?: unknown } | undefined;
          if (spring !== undefined) springs.push({ path: fullKey, bounce: spring.bounce });
          break;
        }
        case 'dimension':
          if (typeof value.$value !== 'string')
            throw new Error(`Token ${fullKey}: dimension $value must be a string`);
          cssVars[cssKey] = value.$value;
          break;
        case 'number':
          if (typeof value.$value !== 'number')
            throw new Error(`Token ${fullKey}: number $value must be a number`);
          cssVars[cssKey] = String(value.$value);
          break;
        default:
          throw new Error(`Token ${fullKey}: unknown $type "${value.$type}"`);
      }
    } else if (typeof value === 'object' && value !== null) {
      flattenGroup(value as DtcgGroup, fullKey, cssVars, raw, meta, springs);
    }
  }
}

// An easing's spring form is `$extensions.spring.bounce`: a "{bounce.10}" reference to a number token.
function resolveSprings(springs: PendingSpring[], raw: Record<string, unknown>): void {
  for (const { path, bounce } of springs) {
    const m = typeof bounce === 'string' ? /^\{(.+)\}$/.exec(bounce) : null;
    if (!m) throw new Error(`Token ${path}: spring bounce must be a token reference like "{bounce.10}"`);
    const ref = m[1]!;
    if (!(ref in raw)) throw new Error(`Token ${path}: spring bounce refers to unknown token "${ref}"`);
    const value = raw[ref];
    if (typeof value !== 'number') throw new Error(`Token ${path}: spring bounce "${ref}" is not a number token`);
    if (value < 0 || value > 1) throw new Error(`Token ${path}: spring bounce "${ref}" must be from 0 to 1`);
    raw[springKey(path)] = { bounce: value, token: ref } satisfies SpringForm;
  }
}

export function compileTokens(dtcgJson: DtcgGroup): CompiledTokens {
  const cssVars: Record<string, string> = {};
  const raw: Record<string, unknown> = {};
  const meta: Record<string, TokenMeta> = {};
  const springs: PendingSpring[] = [];
  flattenGroup(dtcgJson, '', cssVars, raw, meta, springs);
  resolveSprings(springs, raw);
  return { cssVars, raw, meta };
}

export function applyTokensToDom(
  cssVars: Record<string, string>,
  root: HTMLElement = document.documentElement
): void {
  for (const [k, v] of Object.entries(cssVars)) {
    root.style.setProperty(k, v);
  }
}

export function resolveTokenValue(path: string, raw: Record<string, unknown>): unknown {
  if (path in raw) return raw[path];
  throw new Error(`Unknown token path: "${path}"`);
}

// The CSS value of a duration or easing token, e.g. "300ms" or "cubic-bezier(0.2, 0, 0.38, 0.9)".
// A literal (not a token path) is returned as is.
export function tokenCss(raw: Record<string, unknown>, path: string): string | undefined {
  const v = path in raw ? raw[path] : path;
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length === 4) return `cubic-bezier(${v.join(', ')})`;
  return undefined;
}

// A token's name within its group: "easing.productive-standard" → "productive-standard", "duration.300" → "300".
export function tokenLabel(path: string): string {
  return path.slice(path.indexOf('.') + 1);
}

// ── References in keyframes ────────────────────────────────────────────────
// A keyframe value may name tokens: "translateY({distance.16})", "{opacity.56}". A leading minus
// negates one: "translateY(-{distance.16})".

const REF = /(-?)\{([^{}]+)\}/g;

function cssOf(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v) && v.length === 4) return `cubic-bezier(${v.join(', ')})`;
  return undefined;
}

// Token paths named in a keyframe value, e.g. ['distance.16'].
export function findRefs(text: string): string[] {
  return [...text.matchAll(REF)].map(m => m[2]!);
}

// Replace each reference with its value ("16px"), or with var(--motion-distance-16, 16px) for the
// CSS export, where a negative becomes calc(-1 * var(…)). An unknown reference throws.
export function resolveRefs(text: string, raw: Record<string, unknown>, options: { cssVars?: boolean } = {}): string {
  return text.replace(REF, (_all, neg: string, path: string) => {
    if (!(path in raw)) throw new Error(`Unknown token reference: "{${path}}"`);
    const css = cssOf(raw[path]);
    if (css === undefined) throw new Error(`Token "${path}" has no single value to use in a keyframe`);
    if (!options.cssVars) return `${neg}${css}`;
    const value = `var(${tokenVarName(path)}, ${css})`;
    return neg ? `calc(-1 * ${value})` : value;
  });
}
