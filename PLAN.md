# Motion Lab — Plan

## What this is

Motion Lab is a reusable template for iterating on motion for components imported from any Figma file. It replaces an older claude.ai artifact hub.

- **Template repo (a17-motion-lab):** all lab features are built here. It stays client-agnostic.
- **Project repos (e.g. the pilot project repo):** made from the template. They hold client content only: components, versions, pages, presets, assets and baselines. They pull template updates and never build features.

## Done

- Shell: Vite + vanilla TS, Web Animations runtime, component view, live controls, compare, speed, stagger, light/dark, page view with motion map (URL state) and presets.
- Library view: every component as a scaled live preview that plays on hover, with name search and the status filter; cards link to the component view.
- Token-first live controls: duration, easing and delay are dropdowns of system tokens; anything else needs "Custom…" and is flagged. "Tokens used" follows the CSS / Spring engine toggle.
- Spring engine; springs compile to CSS `linear()` with an optional cubic-bezier fallback.
- Tokens view with usage ("used by", tokens per version, unused flagged).
- Figma import via the Figma MCP: close match (not pixel-perfect), up to 2 fix-up passes to under 5% pixel diff, fonts from `/fonts` (gitignored) or the closest fallback, re-import never touches version files.
- Designer workflow rules in CLAUDE.md (designers don't know git; Claude handles branches, saves and reviews in plain language).
- Status (in-progress, review, approved, archived) and lineage per version.
- One file per version for all components (`versions/` folder); presets one file each; `tokens/motion.json` kept as a single file; generated Figma token files are regenerated on conflict, never hand-merged.
- Tests: Vitest + Playwright; `npm run check` must pass.

## Decisions

- No nested components on pages.
- No Claude GitHub Action for now; designers use Claude Code directly.
- Previews will be hosted on Twill (folder upload, password protected).
- `reference/old-motion-lab.html` (gitignored) is the old lab, for porting features only. Never copy client content from it.
- The motion-only rule: versions change motion, never structure.

## Current state

The pilot project repo was freshly created from the template and pulled the latest template changes. Next: re-import the pilot component there.

## Next steps

1. Import 2–3 more components in the pilot project repo.
2. Slash commands: `/lab import`, `/lab version`, save/review, `/lab export`.
3. Spec/export (approved versions only: `tokens.css`/`json`, component CSS, `spec.md`).
4. Twill publish script (waiting on upload details).
5. Designer onboarding guide; a second designer tries it.

## On hold

Token governance: token habits, off-system badge, nearest-token suggestions, approval check, token proposals.

## Optional

- A GitHub Actions workflow running `npm run check`.
- Library: an "all versions" toggle that shows every version of each component side by side.
