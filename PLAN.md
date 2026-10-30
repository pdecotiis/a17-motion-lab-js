# Motion Lab — Plan

## What this is

Motion Lab is a reusable template for iterating on motion for components imported from any Figma file. It replaces an older claude.ai artifact hub.

- **Template repo (a17-motion-lab):** all lab features are built here. It stays client-agnostic.
- **Project repos (e.g. the pilot project repo):** made from the template. They hold client content only: components, versions, pages, presets, assets and baselines. They pull template updates and never build features.

## Done

- Shell: Vite + vanilla TS, Web Animations runtime, component view, live controls, compare, speed, stagger, light/dark, page view with motion map (URL state) and presets.
- Library view: every component as a scaled live preview that plays on hover, with name search and the status filter; cards link to the component view.
- Token structure: `motion.duration.*`, `motion.easing.*`, `motion.transforms.*` (a named duration + easing, `transition` type with `{token}` references), `motion.distance.*`, `motion.springs.*`. CSS variables are now `--motion-duration-base` (the doubled `motion-motion` is gone). Tween versions can set a `transform` instead of duration + easing.
- Controls panel is a dropdown of the system's named options: transforms for a tween, spring tokens for a spring. No duration, easing or delay fields and no "Custom…". "Tokens used" follows the CSS / Spring engine toggle.
- Shared preview config (`.claude/launch.json`): the app's one-click dev server on port 5173, for every project repo.
- Spring engine; springs compile to CSS `linear()` with an optional cubic-bezier fallback.
- Tokens view with usage ("used by", tokens per version, unused flagged).
- Figma import via the Figma MCP: close match (not pixel-perfect), up to 2 fix-up passes to under 5% pixel diff, fonts from `/fonts` (gitignored) or the closest fallback, re-import never touches version files.
- Designer workflow rules in CLAUDE.md (designers don't know git; Claude handles branches, saves and reviews in plain language).
- Status (in-progress, review, approved, archived) and lineage per version.
- One file per version for all components (`versions/` folder); presets one file each; `tokens/motion.json` kept as a single file; generated Figma token files are regenerated on conflict, never hand-merged.
- Developer hand-off baseline: stack-neutral CSS (named `@keyframes`, token custom properties with literal fallbacks, `prefers-reduced-motion` block, springs as `linear()` behind `@supports`) shared by the Generated CSS panel and `npm run spec`, which writes `motion.css`, `tokens.css` and `spec.md` per version.
- `trigger` and `reducedMotion` on versions: validated, shown in the component view, carried through forks, written into the spec. The lab's reduced-motion playback now matches the exported CSS (a tween used to jump instantly; it fades for up to 150ms like springs).
- Tests: Vitest + Playwright; `npm run check` must pass.

## Decisions

- No nested components on pages.
- No Claude GitHub Action for now; designers use Claude Code directly.
- Previews will be hosted on Twill (folder upload, password protected).
- `reference/old-motion-lab.html` (gitignored) is the old lab, for porting features only. Never copy client content from it.
- The motion-only rule: versions change motion, never structure.
- Motion tokens flow Motion Lab → Figma. `tokens/motion.json` is the source of truth for motion; Figma holds a read-only mirror in its own "Motion" variable collection. Visual variables still flow Figma → Motion Lab (import), so the two directions never share a collection.
- Designers choose from named options, not granular values: in the component view they pick from the transforms (or spring tokens), never type a duration, easing or delay. To use a value the system doesn't have, an author adds a token (see token governance, on hold) or edits the version.
- Authors are the core users. Reviewers and tweakers get the hosted Lab. Getting started must still need as little setup as possible: a GitHub account, a machine setup and org repo admin per designer is a real cost for authors, so reducing it (or removing it, see step 8) is a product goal, not a nice-to-have.
- Authoring and iterating on motion happens in Claude. Figma's motion tools don't yet give designers what they need and are lossy when translated to our model, so Figma stays the source of visuals and a synced mirror of motion tokens, not the place motion is authored.
- What the Lab exports should be as close as possible to what a developer actually ships. Judge every export change by how little a developer has to reinterpret.
- Effort to start is a standing product concern. Every new feature should be weighed by whether it makes it easier or harder for a designer to pick the tool up and start working.
- The developer hand-off is stack-neutral CSS first. Library adapters (GSAP, Motion) are added only when a client's stack needs one.
- A version with no `trigger` is "not specified", never defaulted. The spec and CSS say so and tell the developer to ask. Imports never set a trigger.

## Current state

The pilot project repo was freshly created from the template and pulled the latest template changes. Next: re-import the pilot component there.

## Next steps

1. Import 2–3 more components in the pilot project repo.
2. Slash commands: `/lab import`, `/lab version`, save/review, `/lab export`.
3. Spec/export: the baseline exists (`npm run spec`, approved versions by default). Left: a `tokens.json` export, the `/lab export` slash command, and deciding where exports go for a developer (they are in a gitignored `export/` for now).
   - Parity check on the pilot: implement one exported spec in the client's real code, record both, compare. This tests the "no handoff" claim and shows where the model needs to grow.
   - Open: a spec adapter for the client's animation library, only if the parity check shows the CSS isn't enough.
4. Twill publish script (waiting on upload details).
5. Designer onboarding guide; a second designer tries it.
6. Push motion tokens to Figma (`/lab figma-sync`): write `motion.duration.*`, `motion.easing.*`, `motion.transforms.*`, `motion.distance.*` and `motion.springs.*` into a "Motion" variable collection in the linked Figma file via the Figma MCP, so designers see the same names and values in Figma that the Lab uses.
   - Open: Figma variables are boolean/number/string/color only, so easings (cubic-bezier) and springs need a representation: likely strings for easings, numbers for duration/bounce. Check whether Figma's native animation styles can hold the curves too.
   - Open: a transform is a composite (duration + easing). Decide whether it becomes two variables per transform (`entrance/duration`, `entrance/easing`) or aliases to the duration and easing variables.
   - Idempotent: re-running updates changed values and flags removed tokens instead of deleting them.
   - Show in the Tokens view whether each token is in sync with Figma.
7. Low-friction access: define what a designer can do with no GitHub account and no setup. Candidates: use the hosted Lab (step 4) in the browser with the live controls and shareable motion-map URLs; submit a tweak back as a link or preset instead of a pull request; one org-level repo with a single admin step. Decide the tiers (reviewer / tweaker / author) before the second designer onboards.
8. Lower priority, since authoring stays in Claude (see Decisions). Spike (1–2 weeks, one question), only worth running if the setup friction in step 7 can't be reduced enough: can a Figma plugin be the authoring home for designers, with no GitHub? Take a selected frame, render it in the plugin's UI iframe, animate it with the existing runtime, fill the token dropdowns from Figma variables, save versions in the file. Decide go/no-go on two things: is a render from the node tree good enough without Claude's fix-up passes, and would a designer choose it over Figma's native motion for real work? If go, extract the engine (runtime, tokens, springs, spec export) as a library with two shells: this repo and the plugin. Figma Make is not a candidate base (per-file generated apps don't fit a shared template).

## On hold

Token governance: token habits, off-system badge, nearest-token suggestions, approval check, token proposals.

## Optional

- A GitHub Actions workflow running `npm run check`.
- Library: an "all versions" toggle that shows every version of each component side by side.
