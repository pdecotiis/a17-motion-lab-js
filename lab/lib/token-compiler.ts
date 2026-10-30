import type { DtcgToken, DtcgGroup, TransformValue } from './types.js';

export interface CompiledTokens {
  cssVars: Record<string, string>;
  raw: Record<string, unknown>;
}

// The CSS custom property a token path compiles to, e.g. 'motion.duration.base' → '--motion-duration-base'.
export function tokenVarName(path: string): string {
  return `--${path.replace(/\./g, '-')}`;
}

function isDtcgToken(v: unknown): v is DtcgToken {
  return typeof v === 'object' && v !== null && '$type' in v && '$value' in v;
}

function flattenGroup(
  group: DtcgGroup,
  prefix: string,
  cssVars: Record<string, string>,
  raw: Record<string, unknown>,
  transitions: string[],
): void {
  for (const [key, value] of Object.entries(group)) {
    if (key.startsWith('$')) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isDtcgToken(value)) {
      raw[fullKey] = value.$value;
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
        case 'custom-spring':
          // Springs stored in raw only; resolved in JS at runtime
          break;
        case 'transition':
          // A transform names a duration and an easing. It may refer to tokens defined later in
          // the file, so it is resolved once every token is known. Raw only, no CSS variable:
          // the CSS uses the duration and easing variables it points at.
          transitions.push(fullKey);
          break;
        default:
          throw new Error(`Token ${fullKey}: unknown $type "${value.$type}"`);
      }
    } else if (typeof value === 'object' && value !== null) {
      flattenGroup(value as DtcgGroup, fullKey, cssVars, raw, transitions);
    }
  }
}

// "{motion.duration.base}" → the token path, checked to exist and to be the right kind.
// Anything else is a literal value ("300ms", "ease-out") and passes through.
function resolveTransformPart(
  owner: string,
  field: string,
  ref: unknown,
  raw: Record<string, unknown>,
  kind: 'duration' | 'easing',
): string {
  if (typeof ref !== 'string' || ref === '') {
    throw new Error(`Token ${owner}: transition ${field} must be a token reference like "{motion.duration.base}" or a value`);
  }
  const m = /^\{(.+)\}$/.exec(ref);
  if (!m) return ref;
  const path = m[1]!;
  if (!(path in raw)) throw new Error(`Token ${owner}: ${field} refers to unknown token "${path}"`);
  const target = raw[path];
  const ok = kind === 'duration' ? typeof target === 'string' : Array.isArray(target);
  if (!ok) throw new Error(`Token ${owner}: ${field} "${path}" is not a ${kind} token`);
  return path;
}

function resolveTransitions(transitions: string[], raw: Record<string, unknown>): void {
  for (const path of transitions) {
    const v = raw[path];
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      throw new Error(`Token ${path}: transition $value must be an object with duration and timingFunction`);
    }
    const t = v as { duration?: unknown; timingFunction?: unknown; delay?: unknown };
    const resolved: TransformValue = {
      duration: resolveTransformPart(path, 'duration', t.duration, raw, 'duration'),
      easing: resolveTransformPart(path, 'timingFunction', t.timingFunction, raw, 'easing'),
    };
    if (t.delay !== undefined) resolved.delay = resolveTransformPart(path, 'delay', t.delay, raw, 'duration');
    raw[path] = resolved;
  }
}

export function compileTokens(dtcgJson: DtcgGroup): CompiledTokens {
  const cssVars: Record<string, string> = {};
  const raw: Record<string, unknown> = {};
  const transitions: string[] = [];
  flattenGroup(dtcgJson, '', cssVars, raw, transitions);
  resolveTransitions(transitions, raw);
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

export function isTransformValue(v: unknown): v is TransformValue {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    && typeof (v as TransformValue).duration === 'string' && typeof (v as TransformValue).easing === 'string';
}
