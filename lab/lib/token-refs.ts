import type { MotionVersion, PageConfig } from './types.js';
import { findRefs, isSpringForm, springKey } from './token-compiler.js';

export interface TokenRefs {
  tokens: string[];
  hardcoded: { label: string; value: string }[];
}

export interface UsageEntry {
  componentName: string;
  versionId: string;
  versionLabel: string;
}

export type UsageIndex = Map<string, UsageEntry[]>;

// Every token a version uses: its duration, easing and delay, a stagger that is a token, the tokens
// named in its keyframes, and for a spring the bounce token of its easing. bounce-0 means "no
// bounce" and is never listed.
export function getTokenRefs(
  version: MotionVersion,
  raw: Record<string, unknown>,
): TokenRefs {
  const tokens: string[] = [];
  const hardcoded: { label: string; value: string }[] = [];

  function check(value: string | undefined, label: string): void {
    if (!value) return;
    if (value in raw) {
      tokens.push(value);
    } else if (value !== '0ms' && value !== '0') {
      hardcoded.push({ label, value });
    }
  }

  const m = version.model;
  check(m.duration, 'duration');
  check(m.easing, 'easing');
  if (m.delay) check(m.delay, 'delay');
  if (version.stagger) check(version.stagger, 'stagger');

  if (m.model === 'spring') {
    const form = raw[springKey(m.easing)];
    if (isSpringForm(form) && form.bounce !== 0) tokens.push(form.token);
  } else {
    for (const kf of version.keyframes ?? []) {
      for (const v of Object.values(kf)) {
        if (typeof v === 'string') findRefs(v).filter(p => p in raw).forEach(p => tokens.push(p));
      }
    }
  }

  return { tokens: [...new Set(tokens)], hardcoded };
}

function ms(value: string | undefined, raw: Record<string, unknown>): number | undefined {
  const v = value !== undefined && value in raw ? raw[value] : value;
  return typeof v === 'string' && /^[\d.]+m?s$/.test(v) ? (v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000) : undefined;
}

// Pairing rules, as warnings and never errors: productive easings pair with 100–300ms, expressive
// easings with 400–1200ms, and an easing with a bounce is for expressive motion only.
export function pairingWarnings(version: MotionVersion, raw: Record<string, unknown>): string[] {
  const { duration, easing } = version.model;
  if (!(easing in raw)) return [];
  const name = easing.slice(easing.indexOf('.') + 1);
  const warnings: string[] = [];
  const time = ms(duration, raw);
  if (time !== undefined) {
    if (name.startsWith('productive-') && (time < 100 || time > 300)) {
      warnings.push(`${name} is a productive easing: pair it with 100–300ms, not ${time}ms`);
    }
    if (name.startsWith('expressive-') && (time < 400 || time > 1200)) {
      warnings.push(`${name} is an expressive easing: pair it with 400–1200ms, not ${time}ms`);
    }
  }
  const form = raw[springKey(easing)];
  if (isSpringForm(form) && form.bounce > 0 && !name.startsWith('expressive-')) {
    warnings.push(`${name} has a bounce, so it is for expressive motion only`);
  }
  return warnings;
}

export function buildUsageIndex(
  allVersions: { componentName: string; version: MotionVersion }[],
  raw: Record<string, unknown>,
): UsageIndex {
  const index: UsageIndex = new Map();
  for (const { componentName, version } of allVersions) {
    const { tokens } = getTokenRefs(version, raw);
    for (const tokenPath of tokens) {
      const entries = index.get(tokenPath) ?? [];
      entries.push({ componentName, versionId: version.id, versionLabel: version.label });
      index.set(tokenPath, entries);
    }
  }
  return index;
}

// Maps token path → page ids. Pages don't pin versions, so each component
// instance counts as its component's default version.
export type PageUsageIndex = Map<string, string[]>;

export function buildPageUsageIndex(
  pages: PageConfig[],
  defaultVersions: Map<string, MotionVersion>,
  raw: Record<string, unknown>,
): PageUsageIndex {
  const index: PageUsageIndex = new Map();
  for (const page of pages) {
    for (const { component } of page.components) {
      const version = defaultVersions.get(component);
      if (!version) continue;
      for (const tokenPath of getTokenRefs(version, raw).tokens) {
        const pageIds = index.get(tokenPath) ?? [];
        if (!pageIds.includes(page.id)) pageIds.push(page.id);
        index.set(tokenPath, pageIds);
      }
    }
  }
  return index;
}
