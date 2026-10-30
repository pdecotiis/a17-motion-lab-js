# Motion Lab — CLAUDE.md

Read PLAN.md at the start of each session. When a step is completed or a decision changes, update PLAN.md in the same commit.

## Architecture

**Shell**: Vite + vanilla TypeScript. No UI framework.
**Motion runtime**: Web Animations API (`element.animate(keyframes, options)`).
**Tokens**: W3C DTCG JSON (`tokens/motion.json`) → CSS custom properties + raw values.
**Components**: HTML/CSS prototypes with a `motion.ts` file that re-exports named motion versions, one file per version in `versions/`.
**Library**: `/?view=library` lists every registered component as a scaled live preview (plays on hover). It builds from the component registry, so new components appear automatically; filters use `?status=…&archived=1&q=…`. Logic is in `lab/lib/library.ts`.
**Live controls**: in the component view, duration, easing and delay are dropdowns of the system's tokens (`motion.timings.*`, `motion.easings.*`, plus "none" for delay), so designers pick from the system. "Custom…" reveals a free-form field and the override is flagged "(custom, not a token)". "Version default" means no override. Helpers are in `lab/lib/control-options.ts`.
**Tokens used**: follows the CSS / Spring engine toggle. A spring version lists its spring token in both modes, plus the fallback easing only in CSS mode; easing is not pickable while the spring engine shapes it. `getTokenRefs(version, raw, { mode })` in `lab/lib/token-refs.ts`; without `mode` it lists every token (used by the Tokens view).
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
- **Token paths**: dot notation (e.g. `motion.timings.base`)
- **Page IDs**: match folder name (e.g. `pages/home/page.json` has `"id": "home"`)
- **Preset IDs**: `kebab-case` matching the filename

## How to add a new component

1. Create `components/<name>/` directory
2. Add `markup.html` — the component's HTML structure. Add `data-motion-target` attribute to the element that will animate.
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
     model: { model: 'tween', duration: 'motion.timings.base', easing: 'motion.easings.ease-out' },
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

## Token types

| `$type`         | CSS output                        | Example `$value`                       |
|-----------------|-----------------------------------|----------------------------------------|
| `duration`      | CSS custom property (e.g. `150ms`)| `"150ms"`                              |
| `cubicBezier`   | `cubic-bezier(...)` string        | `[0.0, 0.0, 0.2, 1.0]`               |
| `dimension`     | CSS length value                  | `"16px"`                               |
| `custom-spring` | JS only (raw object, no CSS var)  | `{ "bounce": 0.4, "duration": 600 }`  |

Token paths use dot notation: `motion.timings.base`, `motion.easings.ease-out`, `motion.springs.bouncy`.

The token compiler (`lab/lib/token-compiler.ts`) reads `tokens/motion.json` and outputs:
- CSS custom properties applied to `:root` at startup
- A `raw` map for JS-side resolution (used by motion models)

## Motion model rules

### Tween model
```ts
{ model: 'tween', duration: 'motion.timings.base', easing: 'motion.easings.ease-out', delay?: '0ms' }
```
- `duration` and `easing` can be a token path or a literal value (`"300ms"`, `"ease-out"`, `"cubic-bezier(...)"`)

### Spring model
```ts
{ model: 'spring', bounce: 0.4, duration: 'motion.springs.bouncy', delay?: '0ms', properties: [{ property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1 }] }
```
- `bounce`: 0–1 (0 = no bounce, 1 = maximum bounce)
- `duration`: token path or literal ms value
- Springs run a real physics simulation (`lab/lib/spring-engine.ts`). They animate via baked WAAPI keyframes, and compile to a CSS `linear()` timing function (cubic-bezier is used only for the "CSS" engine-mode approximation)
- Spring versions declare `properties[]` instead of `keyframes`

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
- Token paths (e.g. `motion.timings.base`) resolve to expected concrete values

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
| `npm run dev`        | Start Vite dev server (http://localhost:5173)   |
| `npm run build`      | Build to `dist/` with relative paths            |
| `npm run typecheck`  | TypeScript type check (no emit)                 |
| `npm run test`       | Run Vitest unit tests                           |
| `npm run test:e2e`   | Run Playwright E2E tests (starts dev server)    |
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
