# Motion Lab — Plan

## What this is

Motion Lab is a reusable template for iterating on motion for components imported from any Figma file. It replaces an older claude.ai artifact hub.

- **Template repo (a17-motion-lab):** all lab features are built here. It stays client-agnostic.
- **Project repos (e.g. the pilot project repo):** made from the template. They hold client content only: components, versions, pages, presets, assets and baselines. They pull template updates and never build features.

## Done

- Shell: Vite + vanilla TS, Web Animations runtime, component view, compare, speed, stagger, light/dark, page view with motion map (URL state) and presets.
- Library view: every component as a scaled live preview that plays on hover, with name search and the status filter; cards link to the component view.
- Token architecture v2 (see Decisions and CLAUDE.md): primitives only, pairing warnings, token status, name-only token rows with tooltips, token references in keyframes, and a scale generator.
- Token structure: primitives only, no composite tokens. Value-named scales: `duration` (100–1200ms), `distance` (4–48px), `scale` (60–106%), `opacity` (04–56%), `delay` (40/70/120ms, for short offsets and staggers). `easing` is the one semantic layer (productive/expressive standard, entrance, exit, expressive-settle, expressive-bounce, linear). Token paths have no `motion.` root, so they match the Figma variable collection one to one (`easing.productive-standard` is `easing/productive-standard` in Figma); CSS variables keep the prefix (`--motion-duration-300`). A motion step names a duration plus an easing directly.
- No controls in the component view: motion changes are new versions. The panel that tweaked duration and easing is gone, along with its plumbing (`LiveControls`, `control-options`).
- Component view sidebar panels are accordions: Version and Tokens Used open, Version history and Generated CSS closed, Compare with unchanged.
- The lab simulates no springs. The Easing / Spring playback lens, the spring engine (baked keyframes, `linear()` curves, the 0.82 duration rule) and the spring curve previews are removed; bounce tokens and the spring form on easings are gone too. Runtime libraries replace them (see Decisions and the next item).
- Runtime switch **CSS / Motion** in the header (`?runtime=motion`, kept per tab): CSS plays each version's easing curve with WAAPI; Motion (motion.dev `animate`) plays the same motions as springs (`bounce` on a spring version, duration as `visualDuration`). `lab/lib/runtime.ts` (`PlayHandle`), `lab/lib/motion-args.ts` (version → Motion arguments). Exports never change with the runtime. The runtimes are never mixed: CSS plays easing curves for every motion, Motion plays springs for every motion (a spring version with its own bounce, everything else with the **global bounce setting**: a select on the Tokens view's Bounce tab, Motion only, from the bounce tokens only, default `bounce.25`), root and layers alike. Tokens used and pairing warnings follow the runtime: under Motion no easing is listed, there are no pairing warnings, and the bounce token each motion plays with is. Bounce tokens (`bounce.0`, `.25`, `.50`, experimental; Motion's own values) show in the Tokens view under Motion only.
- `side-panel` example component (a settings drawer) for comparing runtimes: v1 tween slide, v2 spring slide (bounce 0.5, overshoots under Motion, never under CSS), v3 spring panel with its content following as tween layers. The e2e test samples the panel position and checks the overshoot differs by runtime.
- Shared preview config (`.claude/launch.json`): the app's one-click dev server on port 5173, for every project repo.
- Tokens view with usage ("used by", tokens per version, unused flagged).
- Figma import via the Figma MCP: close match (not pixel-perfect), up to 2 fix-up passes to under 5% pixel diff, fonts from `/fonts` (gitignored) or the closest fallback, re-import never touches version files.
- Designer workflow rules in CLAUDE.md (designers don't know git; Claude handles branches, saves and reviews in plain language).
- Status (in-progress, review, approved, archived) and lineage per version.
- One file per version for all components (`versions/` folder); presets one file each; `tokens/motion.json` kept as a single file; generated Figma token files are regenerated on conflict, never hand-merged.
- Developer hand-off baseline: stack-neutral CSS (named `@keyframes`, token custom properties with literal fallbacks, `prefers-reduced-motion` block) shared by the Generated CSS panel and `npm run spec`, which writes `motion.css`, `tokens.css` and `spec.md` per version.
- `trigger` and `reducedMotion` on versions: validated, shown in the component view, carried through forks, written into the spec. The lab's reduced-motion playback now matches the exported CSS (a tween used to jump instantly; it fades for up to 150ms like springs).
- Tests: Vitest + Playwright; `npm run check` must pass.

## Decisions

- No nested components on pages.
- No Claude GitHub Action for now; designers use Claude Code directly.
- Previews will be hosted on Twill (folder upload, password protected).
- `reference/old-motion-lab.html` (gitignored) is the old lab, for porting features only. Never copy client content from it.
- The motion-only rule: versions change motion, never structure.
- Motion tokens flow Motion Lab → Figma. `tokens/motion.json` is the source of truth for motion; Figma holds a read-only mirror in its own "Motion" variable collection. Visual variables still flow Figma → Motion Lab (import), so the two directions never share a collection.
- Motion changes are new versions, not tweaks. The component view has no controls (no duration or easing fields, no copy values), so a designer forks a version and edits it. Tokens come from the system: to use a value it doesn't have, an author adds a token (see token governance, on hold).
- Easing is the only family of motion curves: easings carry no spring form (removed 2026-11-01). Bounce tokens came back on 2026-11-01 as the one spring setting, shown under Motion only. A spring is a property of a version (its own `bounce`, a plain number), played only by Motion.
- **Runtime libraries.** The lab does not recreate library logic: it plays with a real runtime and never fakes what the library lacks. Decided and built: the header switch is **CSS / Motion** (CSS is the default; Motion plays a spring version as a real spring, from the version's own `bounce`). **GSAP is an export format, not a preview runtime** (clients mostly use GSAP, but in the preview it would play the same cubic-bezier as CSS): the Generated CSS panel and `npm run spec -- <component> [version] --format gsap` write GSAP code (seconds, `CustomEase` for the easing, `stagger`, layers as timeline positions), easing only. A unit test should load GSAP and check the generated timing against the CSS. Velocity carry-over from interrupted animations is only possible under Motion and is deferred. Steps: (1) done: remove spring faking, one CSS playback path; (2) done: Motion adapter and the CSS / Motion header switch; (3) next: export format picker with GSAP and Motion snippets.
- A version can move more than the root: `layers`, keyed by the `data-motion` name of an inner element, each with its own duration, easing and delay (the card rises while its text rises and fades in). The component view's Tokens used panel is grouped by layer and says where each token sits in the motion.
- Pairing rules are warnings, never errors: productive easings with 100–300ms, expressive with 400–1200ms.
- Token status is `system` (approved) or `experimental`. New tokens start experimental; a renamed or merged token keeps the highest status of the tokens folded into it.
- Keyframes reference tokens (`translateY({distance.16})`, `-{distance.16}` for negatives). Spring `properties[]` `from`/`to` do not yet.
- The primitives can be regenerated from a scale (`npm run tokens:scale`). Names are values, so a new scale renames tokens and the references to them.
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
6. Push motion tokens to Figma (`/lab figma-sync`): write each kind (`duration`, `easing`, `distance`, `scale`, `opacity`, `delay`) into the "Motion" variable collection in the linked Figma file via the Figma MCP. The names already match the collection (dots in a token path are slashes in Figma), so designers see the same names and values in Figma that the Lab uses.
   - Open: Figma variables are boolean/number/string/color only, so easings (cubic-bezier) need a representation: likely strings for easings, numbers for duration. Check whether Figma's native animation styles can hold the curves too.
   - Open: Status, notes and old names have no native Figma field: decide whether they go in the variable description.
   - Idempotent: re-running updates changed values and flags removed tokens instead of deleting them.
   - Show in the Tokens view whether each token is in sync with Figma.
7. Low-friction access: define what a designer can do with no GitHub account and no setup. Candidates: use the hosted Lab (step 4) in the browser with shareable motion-map URLs; submit a tweak back as a link or preset instead of a pull request; one org-level repo with a single admin step. Decide the tiers (reviewer / tweaker / author) before the second designer onboards.
8. Lower priority, since authoring stays in Claude (see Decisions). Spike (1–2 weeks, one question), only worth running if the setup friction in step 7 can't be reduced enough: can a Figma plugin be the authoring home for designers, with no GitHub? Take a selected frame, render it in the plugin's UI iframe, animate it with the existing runtime, fill the token dropdowns from Figma variables, save versions in the file. Decide go/no-go on two things: is a render from the node tree good enough without Claude's fix-up passes, and would a designer choose it over Figma's native motion for real work? If go, extract the engine (runtime, tokens, springs, spec export) as a library with two shells: this repo and the plugin. Figma Make is not a candidate base (per-file generated apps don't fit a shared template).

## Open questions

- `expressive-settle` and `expressive-bounce` hold placeholder curves (experimental): set the system values.
- Gesture thresholds are in the system but have no tokens here: needs values.
- Spring `properties[]` `from`/`to` could name scale, distance and opacity tokens like tween keyframes do.

## On hold

Token governance: token habits, off-system badge, nearest-token suggestions, approval check, token proposals.

## Optional

- A GitHub Actions workflow running `npm run check`.
- Library: an "all versions" toggle that shows every version of each component side by side.
