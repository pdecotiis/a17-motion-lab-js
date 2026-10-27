import type { DtcgToken, DtcgGroup } from './types.js';

export interface CompiledTokens {
  cssVars: Record<string, string>;
  raw: Record<string, unknown>;
}

function isDtcgToken(v: unknown): v is DtcgToken {
  return typeof v === 'object' && v !== null && '$type' in v && '$value' in v;
}

function flattenGroup(
  group: DtcgGroup,
  prefix: string,
  cssVars: Record<string, string>,
  raw: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(group)) {
    if (key.startsWith('$')) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isDtcgToken(value)) {
      raw[fullKey] = value.$value;
      const cssKey = `--motion-${fullKey.replace(/\./g, '-')}`;
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
        case 'custom-spring':
          // Springs stored in raw only; resolved in JS at runtime
          break;
        default:
          throw new Error(`Token ${fullKey}: unknown $type "${value.$type}"`);
      }
    } else if (typeof value === 'object' && value !== null) {
      flattenGroup(value as DtcgGroup, fullKey, cssVars, raw);
    }
  }
}

export function compileTokens(dtcgJson: DtcgGroup): CompiledTokens {
  const cssVars: Record<string, string> = {};
  const raw: Record<string, unknown> = {};
  flattenGroup(dtcgJson, '', cssVars, raw);
  return { cssVars, raw };
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
