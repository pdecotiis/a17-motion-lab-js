# Motion Lab — CLAUDE.md

## Architecture

**Shell**: Vite + vanilla TypeScript. No UI framework.
**Motion runtime**: Web Animations API (`element.animate(keyframes, options)`).
**Tokens**: W3C DTCG JSON (`tokens/motion.json`) → CSS custom properties + raw values.
**Components**: HTML/CSS prototypes with a `motion.ts` file exporting named motion versions.
**Pages**: `page.json` defines an ordered list of component instances for page-level motion review.
**Motion maps**: URL-encoded state (shareable) + saved JSON presets.

```
/lab/              Vite app shell (index.html, main.ts, styles.css, lib/)
/components/       One folder per component (markup.html, styles.css, motion.ts)
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
4. Add `motion.ts` — exports `v1`, `v2`, etc. as `MotionVersion`, plus `versions` array and `defaultVersion` string:
   ```ts
   import type { MotionVersion, ComponentModule } from '../../lab/lib/types.js';
   export const v1: MotionVersion = { ... };
   export const versions: MotionVersion[] = [v1];
   export const defaultVersion = 'v1';
   const module: ComponentModule = { versions, defaultVersion };
   export default module;
   ```
5. Register it in `lab/main.ts`: import the module and call `registerComponent('<name>', module)`
6. Copy the test template: `cp tests/unit/_template.test.ts tests/unit/<name>.test.ts` and fill it in
7. Copy the E2E template: `cp tests/e2e/_template.spec.ts tests/e2e/<name>.spec.ts` and fill it in

## How to add a new motion version

1. In `components/<name>/motion.ts`, add a new export:
   ```ts
   export const v3: MotionVersion = {
     id: 'v3',
     label: 'Descriptive Name',
     model: { model: 'tween', duration: 'motion.timings.base', easing: 'motion.easings.ease-out' },
     keyframes: [ /* only motion properties */ ],
   };
   ```
2. Add it to the `versions` array
3. **Versions may only change motion properties**: `opacity`, `transform`, `filter`, `clip-path`. Never use `display`, `position`, `width`, `height`, or any structural property in keyframes.
4. Add unit tests for the new version in `tests/unit/<name>.test.ts`

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
{ model: 'spring', bounce: 0.4, duration: 'motion.springs.bouncy', delay?: '0ms' }
```
- `bounce`: 0–1 (0 = no bounce, 1 = maximum bounce)
- `duration`: token path or literal ms value
- Springs are approximated to cubic-bezier for Web Animations API (`lab/lib/spring-to-bezier.ts`)

## Testing rules

**Every new component and version requires tests.** Use the templates:
```
tests/unit/_template.test.ts   → copy to tests/unit/<component>.test.ts
tests/e2e/_template.spec.ts    → copy to tests/e2e/<component>.spec.ts
```

### Unit test coverage required per component/version
- `validateMotionVersion(v)` does not throw (no structural keyframe props, no extra properties)
- `resolveTiming(v, raw)` produces a numeric `duration` > 0
- `resolveTiming(v, raw)` produces a string `easing` containing `cubic-bezier`
- Token paths (e.g. `motion.timings.base`) resolve to expected concrete values

### E2E test coverage required per component
- Component renders visibly at `/?view=component&component=<name>`
- Each version plays without console errors

## Scripts

| Command              | Action                                          |
|----------------------|-------------------------------------------------|
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

These fields are reserved in `MotionVersion` but unused:
- `status`: `'in-progress' | 'review' | 'approved' | 'archived'`
- `reviewNotes`: string
- `forkedFrom`: version id (lineage tracking)

Planned future features: status workflow, spec export, Figma import, usage audit, per-component weight tuning.
