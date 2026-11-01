# Motion Lab — CLAUDE.md

Read PLAN.md at the start of each session. When a step is completed or a decision changes, update PLAN.md in the same commit.

## Architecture

**Shell**: Vite + vanilla TypeScript. No UI framework.
**Motion runtime**: Web Animations API (`element.animate(keyframes, options)`).
**Tokens**: W3C DTCG JSON (`tokens/motion.json`) → CSS custom properties + raw values.
**Components**: HTML/CSS prototypes with a `motion.ts` file that re-exports named motion versions, one file per version in `versions/`.
**Library**: `/?view=library` lists every registered component as a scaled live preview (plays on hover). It builds from the component registry, so new components appear automatically; filters use `?status=…&archived=1&q=…`. Logic is in `lab/lib/library.ts`.
**No controls in the component view.** A designer doesn't tweak duration or easing there: a motion change is a **new version** (fork, edit the version file, compare). The component view plays, replays and compares versions, and shows what each uses. The sidebar panels are accordions (native `<details>`): **Version** and **Tokens Used** open by default, in that order, then **Version history** and **Generated CSS** closed; **Compare with** stays a plain panel.
**Playback lens.** The header has a global **Easing / Spring** switch (Easing by default) that decides how every version plays in the lab, whatever it was authored as: its easing curve, or the easing's spring. It applies to the component view (root and layers), the page view, the library previews and Compare, and it persists in the URL (`?play=spring`) and in the tab (sessionStorage) so it survives links between views. `playbackOf(version, raw, mode)` in `lab/lib/motion-models.ts` is the one place that decides: a **tween** as a spring plays its own keyframes with the easing's spring as the timing function (`linear(…)`, as the CSS export does), over the spring's duration (paired duration / 0.82); a **spring version** as easing plays its from/to values as two keyframes with the easing curve over the paired duration; an easing with **no spring form** (the exits, `linear`, a literal) plays as easing and the Playback row says so. Reduced motion is still the short opacity-only fade. The Version panel's **Playback** row says what is playing (`Spring · productive-entrance, bounce 0, 268ms`), and Tokens Used follows the lens (a spring adds its bounce token; bounce-0 is never listed). **The lens never changes exports**: Generated CSS, `spec.md` and `tokens.css` are the version as authored.
**Tokens used**: what each motion of the open version uses, and **where in the motion** each token sits: its duration, easing and delay, a stagger that is a token, the tokens its keyframes name (`0% transform`), and for a spring its easing's bounce token (**bounce-0 means "no bounce" and is never listed**). A version with layers gets a group for the root and one per layer, so you can see the card's tokens apart from its text's. Pairing warnings show under it. `getStepRefs` (per motion), `getTokenRefs` (the whole version) and `pairingWarnings` are in `lab/lib/token-refs.ts`; the Tokens view uses the same index for each token's "used by".
**Tokens view**: `/?view=tokens`. Tabs for duration, easing, distance, scale, opacity and delay; tokens run smallest to largest (easings in system order: productive standard, entrance, exit, then expressive, then linear). **A row is just the token name and a preview** (a curve for easings, a bar for durations and distances); notes, status, value, usage and old names are in the row's tooltip. The easing tab has an **Easing / Spring** switch (easing is the default): Spring shows each easing's bounce step (or "no spring") with a spring curve, and a **Bounces** table below. Bounce has no tab of its own. The curve maths is in `lab/lib/curve.ts`.
**Pages**: `page.json` defines an ordered list of component instances for page-level motion review.
**Motion maps**: URL-encoded state (shareable) + saved JSON presets.

```
/lab/              Vite app shell (index.html, main.ts, styles.css, lib/)
/components/       One folder per component (markup.html, styles.css, motion.ts, versions/)
/pages/            page.json files
/tokens/           DTCG motion tokens (motion.json)
/motion-maps/      Saved presets (JSON)
/tests/unit/       Vitest unit tests
/tests/e2e/        Playwright E2E tests
```

## Naming conventions

- **Components**: `kebab-case` folder names (e.g. `card`, `hero-banner`)
- **Motion versions**: `v1`, `v2`, `v3` — sequential integers, never skip
- **Token paths**: dot notation, group first, no `motion` root, value-named except easing (e.g. `duration.300`, `easing.productive-standard`, `distance.16`)
- **Page IDs**: match folder name (e.g. `pages/home/page.json` has `"id": "home"`)
- **Preset IDs**: `kebab-case` matching the filename

## How to add a new component

1. Create `components/<name>/` directory
2. Add `markup.html` — the component's HTML structure. Add `data-motion-target` to the element that will animate, and `data-motion="<layer>"` (kebab-case) to any inner element a version should move on its own (the title, the text…).
3. Add `styles.css` — component styles using CSS variables from tokens
4. Add `versions/v1.ts` — one file per version, exporting `v1` as a `MotionVersion` (see "How to add a new motion version").
5. Add `motion.ts` — it defines no versions itself; it only re-exports the files in `versions/`, plus the `versions` array and `defaultVersion` string. Every component, hand-built or imported, uses this structure:
   ```ts
   import type { MotionVersion, ComponentModule } from '../../lab/lib/types.js';
   import { v1 } from './versions/v1.js';
   export { v1 };
   export const versions: MotionVersion[] = [v1];
   export const defaultVersion = 'v1';
   const module: ComponentModule = { versions, defaultVersion };
   export default module;
   ```
6. Register it in `lab/main.ts`: import the module and call `registerComponent('<name>', module)`
7. Copy the test template: `cp tests/unit/_template.test.ts tests/unit/<name>.test.ts` and fill it in
8. Copy the E2E template: `cp tests/e2e/_template.spec.ts tests/e2e/<name>.spec.ts` and fill it in

## How to add a new motion version

1. Create `components/<name>/versions/v3.ts` (next free integer) exporting the new version. Never define a version inside `motion.ts`; `tests/unit/version-files.test.ts` fails if you do.
   ```ts
   import type { MotionVersion } from '../../../lab/lib/types.js';
   export const v3: MotionVersion = {
     id: 'v3',
     label: 'Descriptive Name',
     model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-standard' },
     keyframes: [ /* only motion properties */ ],
     status: 'in-progress',   // new versions always start in-progress
     forkedFrom: 'v1',        // the version this was copied from (required)
   };
   ```
   Every version needs lineage: `forkedFrom` (a version id in the same component) or, for an imported v1, `lineage: 'imported from <source>'`. `forkVersion(parent, id, label)` in `lab/lib/version-meta.ts` builds a new version that way.
2. In `motion.ts`, import and re-export it, and add it to the `versions` array
3. **Versions may only change motion properties**: `opacity`, `transform`, `filter`, `clip-path`. Never use `display`, `position`, `width`, `height`, or any structural property in keyframes.
4. Add unit tests for the new version in `tests/unit/<name>.test.ts`, including `validateVersionMeta(versions)`

### Version status

- `status`: `'in-progress' | 'review' | 'approved' | 'archived'` (absent = `in-progress`). Unknown values fail validation.
- Shown as a badge on version tabs, in the version history list, and in the Motion Map. The component view and Motion Map have a status filter; **archived versions are hidden by default** and appear with "Show archived" (URL: `?status=…&archived=1`). The open version is always shown.
- `forkedFrom` must name an existing version of the same component; a version with neither `forkedFrom` nor `lineage` fails `validateVersionMeta`.

### Trigger and reduced motion (developer hand-off)

The lab plays motion on demand, so two things a developer needs live in the version file instead:

```ts
trigger: { on: 'in-view', threshold: 0.2, once: true },  // when it plays in production
reducedMotion: 'fade',                                   // what prefers-reduced-motion visitors get
```

- `trigger.on`: `'load' | 'in-view' | 'hover' | 'click' | 'route-change'`. `threshold` (0–1) is for `in-view` only; `once` says first time only (`true`) or every time (`false`). **Absent = not specified**: the spec and the Generated CSS say so, they never guess one. Ask the designer when they haven't said; don't invent it. Imports don't set it.
- `reducedMotion`: `'fade'` (absent = fade: transforms dropped, opacity fade of at most 150ms, `REDUCED_MOTION_FADE_MS`) or `'none'` (no animation, end state shown). The lab's playback and the exported CSS follow the same rule, so what a designer sees under reduced motion is what ships. Versions with no opacity change get no animation under `'fade'`.
- Both validate in `validateMotionVersion`, show in the component view ("Plays", "Reduced motion"), and carry through `forkVersion`.

**Generated CSS and spec export.** The "Generated CSS" panel and `npm run spec` share one generator (`lab/lib/css-output.ts`): plain, stack-neutral CSS with named `@keyframes motion-<component>-<version>`, a `.motion-<component>-<version>` class, token custom properties with the literal value as fallback (`var(--motion-duration-300, 300ms)`), a stagger index (`--motion-index`) and a `prefers-reduced-motion` block. A spring ships as a `linear()` curve (browsers without `linear()` are not supported, so there is no fallback); spring and linear properties become two animations so linear fades don't overshoot.

`npm run spec -- <component> [version] [--out <dir>]` writes `export/<component>/<version>/` (gitignored) with `motion.css`, `tokens.css` and `spec.md` (`lab/lib/spec.ts`). No version = every approved version; an explicit version exports whatever its status and says so in `spec.md`. `spec.md` also lists what the lab can't verify: the production element, layout and environment, and performance.

## Token types

Tokens are **primitives only**: no composite tokens, no component-specific names. A motion step names its primitives directly, a duration plus an easing (`duration.300` + `easing.productive-standard`).

| Kind (group) | `$type` | Names | Values | CSS variable |
|---|---|---|---|---|
| `duration` | `duration` | `100 140 220 300 400 560 800 1200` | ms | `--motion-duration-300` |
| `easing` | `cubicBezier` | `productive-standard/-entrance/-exit`, `expressive-standard/-entrance/-exit`, `expressive-settle`, `expressive-bounce`, `linear` | `[x1, y1, x2, y2]` | `--motion-easing-productive-standard` |
| `bounce` | `number` | `0 10 25` | 0, 0.1, 0.25 | `--motion-bounce-10` |
| `distance` | `dimension` | `4 8 12 16 24 32 40 48` | px | `--motion-distance-16` |
| `scale` | `number` | `60 75 90 95 96 97 98 99 103 106` | percent as a number (0.95) | `--motion-scale-95` |
| `opacity` | `number` | `04 08 10 56` | percent as a number (0.04) | `--motion-opacity-04` |
| `delay` | `duration` | `40 70 120` | ms, for short offsets and staggers (longer delays use the duration scale) | `--motion-delay-70` |

Gesture **thresholds** are part of the system but have no tokens here yet (no values were supplied).

Scale kinds are **named by their value** (`duration.300` is 300ms, `scale.95` is 95%); **easing is the one semantic layer**. Token paths use dot notation with no `motion` root; CSS variables add a `motion` prefix and drop the dots, so they can't collide with other custom properties.

**Figma mapping.** `tokens/motion.json` is shaped like the Figma variable collection it mirrors: the file is the collection (no root group) and each group is a variable group, so `easing.productive-standard` here is `easing/productive-standard` in Figma (dots become slashes). Keep names identical in both so the sync (see PLAN.md) is a straight copy.

**Springs are a view of easing, not a separate family.** An easing token carries a spring form in `$extensions`: `"spring": { "bounce": "{bounce.10}" }` (a reference to a bounce token). The compiler keeps the easing's value as is and adds a derived entry `<path>.spring` (`{ bounce, token }`, see `springKey` / `isSpringForm`), which is not a token in the file. The standard and entrance easings (productive and expressive) use `bounce.0`, `expressive-settle` uses `bounce.10`, `expressive-bounce` uses `bounce.25`; **the two exits and `linear` have none** (a spring can't ease in). A spring's own duration is **always its paired duration / 0.82** (`SPRING_DURATION_RATIO` in `lab/lib/spring-engine.ts`); previews switch between easing and spring playback.

**Pairing rules** (warnings, never errors; `pairingWarnings`): productive easings pair with 100–300ms, expressive easings with 400–1200ms, and an easing with a bounce is for expressive motion only. Shown under "Tokens used".

**Status.** Every token is `system` (approved) or `experimental`, in `$extensions.status`. A token with no status is experimental, as **new tokens start experimental**. **A renamed or merged token keeps the highest status of the tokens folded into it** (system outranks experimental). Notes are `$description`; old names are `$extensions.oldNames` (shown with usage in the Tokens view tooltip). `expressive-settle` and `expressive-bounce` currently hold **placeholder curves** (experimental) until the system values are set.

**References in keyframes.** A tween keyframe value may name tokens: `translateY({distance.16})`, `{opacity.56}`, `scale({scale.95})`; a leading minus negates one (`translateY(-{distance.16})`, the "-distance-N" form). Playback resolves them to values (`resolveKeyframes`); the CSS export writes `var(--motion-distance-16, 16px)` and `calc(-1 * var(…))` for a negative; they count as usage. An unknown reference throws. Spring `properties[]` `from`/`to` are still plain numbers.

**Scaling the primitives.** `npm run tokens:scale -- <duration|distance|delay> <fibonacci|ratio> [--base N] [--steps N]` (`scripts/scale-tokens.ts`) regenerates one kind from a scale and follows the renames through the version files (see the file header). Names are values, so a new scale renames tokens: step i keeps the old step's status and notes and records its old name in `oldNames`; extra steps start experimental; folded steps keep the highest status. Not for `easing`, `bounce`, `scale` or `opacity`.

The token compiler (`lab/lib/token-compiler.ts`) reads `tokens/motion.json` and returns `{ cssVars, raw, meta }`: the CSS custom properties applied to `:root` at startup, a flat `raw` map by path for the motion models, and each token's notes, status and old names.

## Motion model rules

### Tween model
```ts
{ model: 'tween', duration: 'duration.300', easing: 'easing.productive-standard', delay?: 'delay.40' }
```
- `duration` and `easing` are token paths, or literal values (`"300ms"`, `"ease-out"`, `"cubic-bezier(...)"`; a literal is flagged as hard-coded). `delay` and `stagger` may be delay tokens or literals.
- A tween plays its easing curve.

### Spring model
```ts
{ model: 'spring', duration: 'duration.300', easing: 'easing.expressive-settle', delay?: 'delay.40', properties: [{ property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1 }] }
```
- The same primitives as a tween. The **bounce comes from the easing's spring form** (an easing with none, such as an exit or `linear`, throws), and the spring lasts the paired duration / 0.82.
- `springParts(model, raw)` in `lab/lib/motion-models.ts` resolves it to `{ bounce, durationMs, pairedMs, bounceToken }`.
- Springs run a real physics simulation (`lab/lib/spring-engine.ts`). They animate via baked WAAPI keyframes and export as a CSS `linear()` timing function. We assume browsers that support `linear()`: there is no cubic-bezier fallback and no CSS-approximation mode.
- Spring versions declare `properties[]` instead of `keyframes`.

### Layers
```ts
{
  id: 'v4', label: 'Fade Up, Text Follows',
  model: { model: 'tween', duration: 'duration.220', easing: 'easing.productive-entrance' },   // the root
  keyframes: [ … ],
  layers: {
    title: { model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance', delay: 'delay.70' }, keyframes: [ … ] },
    text:  { model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance', delay: 'delay.120' }, keyframes: [ … ] },
  },
}
```
- A version moves the component's root (`data-motion-target`) with its own `model` and `keyframes`, and may move **layers** too: `layers` is keyed by the `data-motion` name of an element inside the root, and each layer is a `MotionStep` (`model` plus `keyframes`, a tween or a spring) with **its own duration, easing and delay**. That is how the text moves differently from the card.
- A layer shares the version's `stagger`, `trigger` and `reducedMotion`. Use `delay` (a delay token) to start a layer after the root. A layer name must be lowercase letters, numbers and hyphens; every element with that `data-motion` is animated.
- `stepsOf(version)` in `lab/lib/motion-models.ts` lists the root (name `null`) and then each layer, each as a version of its own, so timing, usage and CSS work on a layer exactly as on the root.
- CSS export: a layer gets its own `.motion-<component>-<version>-<layer>` class and `@keyframes`; `spec.md` has a "Layer: <name>" section for each. Playback cancels and replays the layers with the root, and the speed control reaches them.

## Testing rules

**Every new component and version requires tests.** Use the templates:
```
tests/unit/_template.test.ts   → copy to tests/unit/<component>.test.ts
tests/e2e/_template.spec.ts    → copy to tests/e2e/<component>.spec.ts
```

### Unit test coverage required per component/version
- `validateMotionVersion(v)` does not throw (no structural keyframe props, no extra properties)
- Tween versions: `resolveTiming(v, raw)` produces a numeric `duration` > 0 (`resolveTiming` is tween-only and throws on spring versions)
- Tween versions: `resolveTiming(v, raw)` produces a string `easing` containing `cubic-bezier`
- Token paths (e.g. `duration.300`, `easing.productive-standard`) resolve to expected concrete values; a spring's easing has a spring form

### E2E test coverage required per component
- Component renders visibly at `/?view=component&component=<name>`
- Each version plays without console errors

## Figma import

Components can be imported from a Figma frame instead of hand-built. The Figma MCP (design context, variables, screenshot, assets) is driven by the agent; the deterministic, file-writing half lives in `scripts/figma-import/lib.ts`. The agent writes a manifest JSON and runs `npm run figma:import -- <manifest.json>` (see the header of `scripts/figma-import/cli.ts` for the manifest shape).

### Import rules

- **Name**: kebab-case from the Figma layer name (`hero banner` → `hero-banner`). If the linked frame is a generic wrapper, name it from its only meaningful child.
- **Output**: `components/<name>/` gets `markup.html`, `styles.css`, `assets/`, `meta.json` (Figma url, file key, node id, import date, frame size, variables, assets, font fallbacks, designer-facing `issues`), and — first import only — `motion.ts` + `versions/v1.ts`.
- **Markup**: the root element has `data-motion-target`; every animatable layer has `data-motion="<layer-name>"`. Asset references are relative: `assets/<file>`. Never leave temporary Figma asset URLs (`figma.com/api/mcp/asset/...`) in the source.
- **Styles**: use CSS custom properties from Figma variables (`text/default` → `--text-default`). No hard-coded colors or spacing that a variable covers.
- **Variables**: merged across imports into `tokens/figma-variables.json`; `tokens/visual.css` and `tokens/fonts.css` are generated from it. Never edit those three files by hand.
- **Fonts**: licensed font files go in `/fonts` (gitignored). Files are matched to Figma typefaces by name; unmatched faces use a system fallback and are listed in `meta.json` `fontFallbacks`.
- **Re-import**: refreshes markup, styles, assets, meta and variables only. It never modifies `motion.ts` or anything in `versions/`, so motion work survives a re-import. Version files stay `v1.ts`, `v2.ts`, … without gaps.
- **Motion**: v1 is a scaffolded default entrance (`status: 'in-progress'`, `lineage: 'imported from <figma link>'`). Imports never invent motion beyond that.
- **Scaled frames**: if the linked frame is a scaled instance, `designWidth` records the native width. The lab lays the component out at `designWidth` and zooms to `frame.width`.
- **Issues**: record Figma file problems for designers (no auto layout, unnamed layers, variant strings as layer names, values not bound to variables) in `meta.json` `issues`.

### Fidelity target

The component's static end state (after all animations finish) must match the Figma screenshot within **5%** of pixels (`MAX_DIFF_RATIO` in `tests/e2e/visual.ts`, pixelmatch threshold 0.1). Fix the markup/styles to close a gap rather than raising the threshold.

### Visual check

- `/?view=frame&component=<name>&version=<id>` renders the component alone at its Figma frame size, with no lab chrome.
- `compareToBaseline(page, component, version)` in `tests/e2e/visual.ts` loads that view at the baseline's size, waits for fonts, images and animations, and diffs against `tests/baselines/<component>.png` (the Figma screenshot). Actual and diff images are written to `tests/visual-output/` (gitignored).
- Each imported component adds an E2E spec that renders it, plays each version without console errors, and calls `compareToBaseline`. Commit its baseline PNG.
- Unit tests for the importer use a generic fixture built in a temp directory (`tests/unit/figma-import.test.ts`); do not commit a real client component as a fixture.

## Designer workflow

Designers do not know git and work only through Claude. Handle version control for them, silently. **Never use git jargon** (branch, commit, merge, rebase, conflict, PR, push, pull, stash, diff) in replies unless the designer uses the word first; then mirror their vocabulary. Don't mention git at all unless asked.

### Session start

1. Learn the designer's first name (ask once if unknown) and what they want to explore.
2. Pull the latest `main`, then create a branch named `<designer>/<exploration>` (kebab-case, e.g. `maya/hero-entrance`) from what they describe. If they are continuing earlier work, switch to their existing branch and bring it up to date with `main` instead.
3. Start the dev server and open the lab in the browser (`npm run dev`), on the component or page they're working on.
4. Greet them with what's ready ("The lab is open on the hero. What should we try?"), not with setup details.

### "Save this"

Commit everything they've changed with a clear, descriptive message (what changed and why, e.g. "Hero v3: slower fade with a slight rise"). Confirm in plain words naming what was saved ("Saved hero v3"). Do not show hashes or file lists.

### "Ready for review"

1. Set `status: 'review'` on the version(s) they're submitting (they must already have `forkedFrom` or `lineage` set). Leave other versions' status alone. Only mark a version `approved` or `archived` when the designer asks.
2. Run `npm run check`; fix anything that fails before continuing. If you can't fix it, explain simply what's wrong.
3. Save, push the branch, and open a pull request titled after the exploration, with a short plain-language summary of what changed.
4. Give them the link: "Sent for review: <link>".

### When others changed the same work

Before saving and before sending for review, bring in the latest `main`. If someone else changed the same files:

- **Resolve automatically when safe**: edits to different parts of a file, identical changes, or independent additions. Keep both sides. Explain in one simple sentence ("Someone updated the card styles; I kept their change alongside yours").
- **Version numbers**: if both sides added the same version id (e.g. both made `v3`), renumber the designer's to the next free integer (file, `id`, export, `versions` array, tests). Never skip or reuse numbers.
- **Generated token files**: if `tokens/figma-variables.json`, `tokens/visual.css`, or `tokens/fonts.css` conflict during a merge, don't merge them by hand. Take either side, then regenerate all three by re-running `npm run figma:import` for each imported component from its Figma source (`meta.json` `figma.url`).
- **Ask only for a real design choice**: both people changed the same motion value or the same version's look. Describe the two options in design terms ("Their hero fades in over 400ms, yours over 600ms. Which should we keep?"), then apply the answer.
- After resolving, rerun `npm run check`.

### Rules of thumb

- Never work directly on `main`; never discard a designer's changes without asking.
- Don't edit another designer's version files; add a new version instead.
- If something goes wrong with saving or syncing, say what it means for their work ("Your changes are safe, but I couldn't send them yet") and fix it, rather than reporting git errors.

## Scripts

| Command              | Action                                          |
|----------------------|-------------------------------------------------|
| `npm run figma:import -- <manifest.json>` | Import a Figma frame as a component |
| `npm run spec -- <component> [version]` | Export motion.css, tokens.css and spec.md for a developer |
| `npm run tokens:scale -- <kind> <scale>` | Regenerate duration, distance or delay from fibonacci or a ratio |
| `npm run dev`        | Start Vite dev server (http://localhost:5173)   |
| `npm run build`      | Build to `dist/` with relative paths            |
| `npm run typecheck`  | TypeScript type check (no emit)                 |
| `npm run test`       | Run Vitest unit tests                           |
| `npm run test:e2e`   | Run Playwright E2E tests (starts dev server; `PORT=5200 npm run test:e2e` when another server holds 5173) |
| `npm run check`      | typecheck + test + build + test:e2e (all four)  |

**`npm run check` must pass before reporting a session as done.**

## Build

- Output goes to `dist/` with `base: './'` (relative paths for Twill upload)
- Do not use absolute URLs or hardcoded paths in source files
- The lab shell fetches component markup via relative `fetch('../components/<name>/markup.html')` paths at runtime

## Future data model (do not build yet)

This field is reserved in `MotionVersion` but unused:
- `reviewNotes`: string

Planned future features: spec export, usage audit, per-component weight tuning.
