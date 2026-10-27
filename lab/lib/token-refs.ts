import type { MotionVersion, TweenModel, SpringModel } from './types.js';

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

export function getTokenRefs(version: MotionVersion, raw: Record<string, unknown>): TokenRefs {
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

  if (version.model.model === 'tween') {
    const m = version.model as TweenModel;
    check(m.duration, 'duration');
    check(m.easing, 'easing');
    if (m.delay) check(m.delay, 'delay');
  } else {
    const m = version.model as SpringModel;
    check(m.duration, 'duration');
    if (m.delay) check(m.delay, 'delay');
  }

  return { tokens: [...new Set(tokens)], hardcoded };
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
