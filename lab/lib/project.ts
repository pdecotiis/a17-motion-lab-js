// The project the lab is showing: its name, for the header and the tab title. It is the project's own, in
// `project.json` at the repo root ({ "name": "Jane Street" }); the template ships none, so a template or a project
// that has not named itself just says "Motion Lab". Pure: lab/main.ts loads the file.

export const PRODUCT_NAME = 'Motion Lab';
const MAX_NAME = 60;

/** The project's name from the parsed project.json, or undefined when there is none (or it is not a usable name). */
export function projectNameOf(config: unknown): string | undefined {
  if (typeof config !== 'object' || config === null) return undefined;
  const name = (config as { name?: unknown }).name;
  if (typeof name !== 'string') return undefined;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_NAME ? trimmed : undefined;
}

/** "Jane Street · Motion Lab", or "Motion Lab". */
export function brandText(project?: string): string {
  return project ? `${project} · ${PRODUCT_NAME}` : PRODUCT_NAME;
}

/** The tab title: what is on screen, then the brand ("card – Jane Street · Motion Lab"). */
export function titleFor(what: string, project?: string): string {
  return what ? `${what} – ${brandText(project)}` : brandText(project);
}
