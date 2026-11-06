import type { DtcgToken, DtcgGroup, TokenMeta, TokenStatus } from './types.js';

export interface CompiledTokens {
  cssVars: Record<string, string>;
  /** Token values by path. */
  raw: Record<string, unknown>;
  /** Notes, status and old names by token path. */
  meta: Record<string, TokenMeta>;
}

export const TOKEN_STATUSES: readonly TokenStatus[] = ['system', 'experimental'];

// The CSS custom property a token path compiles to, e.g. 'duration.250' → '--motion-duration-300'.
// Token paths carry no "motion" root: the token file is the namespace, as a collection is in Figma
// (easing/productive-standard). The CSS variable keeps the prefix so it can't collide with others.
export function tokenVarName(path: string): string {
  return `--motion-${path.replace(/\./g, '-')}`;
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
      flattenGroup(value as DtcgGroup, fullKey, cssVars, raw, meta);
    }
  }
}

export function compileTokens(dtcgJson: DtcgGroup): CompiledTokens {
  const cssVars: Record<string, string> = {};
  const raw: Record<string, unknown> = {};
  const meta: Record<string, TokenMeta> = {};
  flattenGroup(dtcgJson, '', cssVars, raw, meta);
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

// A token's name within its group: "easing.productive-standard" → "productive-standard", "duration.250" → "300".
export function tokenLabel(path: string): string {
  return path.slice(path.indexOf('.') + 1);
}

// ── References in keyframes ────────────────────────────────────────────────
// A keyframe value may name tokens: "translateY({distance.20})", "{opacity.100}". A leading minus
// negates one: "translateY(-{distance.20})".

const REF = /(-?)\{([^{}]+)\}/g;

function cssOf(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v) && v.length === 4) return `cubic-bezier(${v.join(', ')})`;
  return undefined;
}

// Token paths named in a keyframe value, e.g. ['distance.20'].
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
