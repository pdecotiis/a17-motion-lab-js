# Motion Lab — Plan

## What this is

Motion Lab is a reusable template for iterating on motion for components imported from any Figma file. It replaces an older claude.ai artifact hub.

- **Template repo (a17-motion-lab):** all lab features are built here. It stays client-agnostic.
- **Project repos (e.g. the pilot project repo):** made from the template. They hold client content only: components, versions, pages, presets, assets and baselines. They pull template updates and never build features.

## Done

- Shell: Vite + vanilla TS, Web Animations runtime, component view, live controls, compare, speed, stagger, light/dark, page view with motion map (URL state) and presets.
- Library view: every component as a scaled live preview that plays on hover, with name search and the status filter; cards link to the component view.
- Token-first live controls: duration, easing and delay are dropdowns of system tokens; anything else needs "Custom…" and is flagged. "Tokens used" follows the CSS / Spring engine toggle.
- Shared preview config (`.claude/launch.json`): the app's one-click dev server on port 5173, for every project repo.
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
- Motion tokens flow Motion Lab → Figma. `tokens/motion.json` is the source of truth for motion; Figma holds a read-only mirror in its own "Motion" variable collection. Visual variables still flow Figma → Motion Lab (import), so the two directions never share a collection.
- Getting started must need as little setup as possible. Requiring a GitHub account, a machine setup and org repo admin for every designer is too much friction; GitHub and Claude Code are for the few designers who author motion, not for everyone who reviews or tweaks it.

## Current state

The pilot project repo was freshly created from the template and pulled the latest template changes. Next: re-import the pilot component there.

## Next steps

1. Import 2–3 more components in the pilot project repo.
2. Slash commands: `/lab import`, `/lab version`, save/review, `/lab export`.
3. Spec/export (approved versions only: `tokens.css`/`json`, component CSS, `spec.md`).
4. Twill publish script (waiting on upload details).
5. Designer onboarding guide; a second designer tries it.
6. Push motion tokens to Figma (`/lab figma-sync`): write `motion.timings.*`, `motion.easings.*` and `motion.springs.*` into a "Motion" variable collection in the linked Figma file via the Figma MCP, so designers see the same names and values in Figma that the Lab uses.
   - Open: Figma variables are boolean/number/string/color only, so easings (cubic-bezier) and springs need a representation: likely strings for easings, numbers for duration/bounce. Check whether Figma's native animation styles can hold the curves too.
   - Idempotent: re-running updates changed values and flags removed tokens instead of deleting them.
   - Show in the Tokens view whether each token is in sync with Figma.
7. Low-friction access: define what a designer can do with no GitHub account and no setup. Candidates: use the hosted Lab (step 4) in the browser with the live controls and shareable motion-map URLs; submit a tweak back as a link or preset instead of a pull request; one org-level repo with a single admin step. Decide the tiers (reviewer / tweaker / author) before the second designer onboards.

## On hold

Token governance: token habits, off-system badge, nearest-token suggestions, approval check, token proposals.

## Optional

- A GitHub Actions workflow running `npm run check`.
- Library: an "all versions" toggle that shows every version of each component side by side.
