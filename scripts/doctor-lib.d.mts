export type Version = [number, number, number];
export type Status = 'ok' | 'warn' | 'fail' | 'info';
export interface CheckResult { id: string; status: Status; title: string; fix?: string }
export interface Context {
  nodeVersion?: string;
  home?: string;
  env?: Record<string, string | undefined>;
  platform?: string;
  git?: () => string | null;
}
export function parseVersion(text: string): Version | null;
export function atLeast(have: Version, want: Version): boolean;
export function requiredNode(root: string): Version;
export function nodeFix(ctx?: { home?: string; env?: Record<string, string | undefined>; platform?: string }): string;
export function playwrightCache(ctx?: { home?: string; env?: Record<string, string | undefined>; platform?: string }): string;
export function missingFonts(root: string): string[];
export function runChecks(root: string, mode?: 'quick' | 'check' | 'full', ctx?: Context): CheckResult[];
export function formatResults(results: CheckResult[], options?: { quiet?: boolean }): string;
