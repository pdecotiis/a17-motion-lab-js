# Motion Lab — CLAUDE.md

Read PLAN.md at the start of each session. When a step is completed or a decision changes, update PLAN.md in the same commit.

## Architecture

**Shell**: Vite + vanilla TypeScript. No UI framework.
**Motion runtime**: the lab plays with a runtime chosen in the header, **CSS / Motion** (CSS by default), and **never mixes them: CSS plays easing curves for every motion, Motion plays springs for every motion**, the root and every layer. **CSS** is the Web Animations API (`element.animate(keyframes, options)`). **Motion** is motion.dev's `animate`, a real library with springs. The lab simulates nothing a runtime lacks.
**Tokens**: W3C DTCG JSON (`tokens/motion.json`) → CSS custom properties + raw values.
**Components**: HTML/CSS prototypes with a `motion.ts` file that re-exports named motion versions, one file per version in `versions/`.
**Library**: `/?view=library` lists every registered component as a scaled live preview (plays on hover). It builds from the component registry, so new components appear automatically; filters use `?status=…&archived=1&q=…` (a component's status). Logic is in `lab/lib/library.ts`.
**No controls in the component view.** A designer doesn't tweak duration or easing there: a motion change is a **new version** (fork, edit the version file, compare). The component view plays, replays and compares versions, and shows what each uses. The sidebar panels are accordions (native `<details>`): **Version** (the version tabs, lineage, Replay and the state controls), **Details** and **Tokens Used** open by default, in that order, then **Version history** and **Generated code** closed; **Compare with** stays a plain panel. **Details** is everything about the open version in one place: **What it does** (interaction versions: the plain-language summary), then a list with **Component status**, **Plays**, **Reduced motion** and **Playback**.
**Playback and runtimes.** `playbackOf(version, raw, { playbackRate, reducedMotion })` in `lab/lib/motion-models.ts` is the CSS runtime: a tween plays its keyframes with the easing curve over its duration; a **spring version** (authored with `properties[]` and a `bounce`) plays its from/to values as two keyframes with the easing curve, and the Playback row says so. `motionArgsOf(version, raw, …)` in `lab/lib/motion-args.ts` translates a version into Motion's terms and **always returns a spring** (`type: 'spring'`, the duration token as Motion's `visualDuration`, seconds): a spring version uses its own `bounce` (a bounce token or a number) and **every other motion (tweens, layers) uses the global bounce setting**; no easing curve is used anywhere under Motion. **Global bounce**: a select on the **Tokens view's Bounce tab** (a tab that shows only under Motion), listing the bounce tokens and nothing else (default `bounce.25`, Motion's own default); it persists in the URL (`?bounce=50`) and the tab, and every view reads it when it plays. A spring has no in-between frames, so it plays each property from its first value to its last (a tween with frames between says it skips them). `lab/lib/runtime.ts` holds the `Runtime` type and `PlayHandle` (speed, time, cancel, whatever runs the motion), so the speed control, replay and compare work the same on both. The header switch persists in the URL (`?runtime=motion`, absent = CSS) and in the tab (sessionStorage) so it survives links between views; it applies to the component, page and library views and Compare. Reduced motion is the short opacity-only fade under both (a spring with no bounce under Motion). The Version panel's **Playback** row says what is playing (CSS: `Easing · productive-entrance, 220ms`; Motion: `Spring · bounce 0.25 (bounce.25), 220ms (authored as easing; bounce is the global setting)`). **The runtime never changes exports**: Generated CSS, `spec.md` and `tokens.css` are the version as authored. A stale `?play=spring` in a URL is ignored.
**Tokens used**: what each motion of the open version uses, and **where in the motion** each token sits: its duration, easing and delay, a stagger that is a token, and the tokens its keyframes name (`0% transform`). A version with layers gets a group for the root and one per layer, so you can see the card's tokens apart from its text's. **It follows the runtime**: under Motion nothing plays an easing (every motion is a spring), so no easing token is listed and there are no pairing warnings; duration, delay, stagger and keyframe tokens still are, plus the **bounce token** each motion plays with (its own, else the global setting; a plain-number bounce is flagged as hard-coded). Under CSS it lists everything. Pairing warnings show under it. `getStepRefs(version, raw, runtime?)` (per motion), `getTokenRefs` (the whole version, as authored: what exports) and `pairingWarnings(version, raw, runtime?)` (per motion), `getTokenRefs` (the whole version) and `pairingWarnings` are in `lab/lib/token-refs.ts`; the Tokens view uses the same index for each token's "used by".
**Tokens view**: `/?view=tokens`. Tabs for duration, easing, distance, scale, opacity and delay (with the **default stagger** setting above its table), plus **bounce under Motion only** (the **global bounce setting** above the table, and three rows with a spring curve drawn from Motion's own spring generator, `springCurve` in `lab/lib/curve.ts`); tokens run smallest to largest (easings in system order: productive standard, entrance, exit, then expressive, then linear). **A row is just the token name and a preview** (a curve for easings, a bar for durations and distances); notes, status, value, usage and old names are in the row's tooltip.  The curve maths is in `lab/lib/curve.ts`.
**Pages**: `page.json` defines an ordered list of component instances for page-level motion review. **Page stagger uses delay tokens, never a free number** (`lab/lib/stagger.ts`): the page view's Stagger panel is a select of `Default (delay.70)`, `None` and each delay token (a page's own choice is `?pageStagger=none|120…`, absent = the default). The **default stagger** is a setting like the global bounce: a select on the **Tokens view's Delay tab**, delay tokens only, default `delay.70`, persisted in the URL (`?stagger=120`, a token label; anything else, such as an old millisecond link, falls back to `delay.70`) and the tab. Component *k* of the page starts *k* × the stagger token after the first; the Tokens view tooltip says which delay token is the default page stagger.
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
   const module: ComponentModule = { versions, defaultVersion };   // add status: "review" etc. when the component moves on (absent = in-progress)
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
     forkedFrom: 'v1',        // the version this was copied from (required)
   };
   ```
   Every version needs lineage: `forkedFrom` (a version id in the same component) or, for an imported v1, `lineage: 'imported from <source>'`. `forkVersion(parent, id, label)` in `lab/lib/version-meta.ts` builds a new version that way.
2. In `motion.ts`, import and re-export it, and add it to the `versions` array
3. **Versions may only change motion properties**: `opacity`, `transform`, `filter`, `clip-path`. Never use `display`, `position`, `width`, `height`, or any structural property in keyframes.
4. Add unit tests for the new version in `tests/unit/<name>.test.ts`, including `validateVersionMeta(versions)`

### Component status and lineage

- **Approval is the component's, not a version's.** A component's `motion.ts` may set `status` on the module: `'in-progress' | 'review' | 'approved' | 'archived'` (absent = `in-progress`; unknown values fail `validateVersionMeta(versions, status)`). A version file has **no** `status` (it fails validation as a disallowed property). Versions are just the explorations; which one ships is decided by approving the component, and the approved version is its **latest**.
- Shown as a badge on the library cards (not for in-progress) and as the **Component status** row in the component's Details. The library has the status filter; **archived components are hidden by default** and appear with "Show archived" (URL: `?status=…&archived=1`). The component view and the Motion Map have no status filter and no version badges.
- `npm run spec` with no version exports the component's **latest version** when the component is approved; with a version id it exports that one whatever the status, and `spec.md` says "Component status: …".
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

**Generated CSS and spec export.** The "Generated code" panel (CSS, GSAP or Motion) and `npm run spec` share one generator (`lab/lib/css-output.ts`): plain, stack-neutral CSS with named `@keyframes motion-<component>-<version>`, a `.motion-<component>-<version>` class, token custom properties with the literal value as fallback (`var(--motion-duration-300, 300ms)`), a stagger index (`--motion-index`) and a `prefers-reduced-motion` block. A version authored as a spring exports its from/to values with its easing (CSS has no spring), with a comment saying so.

`npm run spec -- <component> [version] [--out <dir>] [--format css|gsap|motion|all] [--bounce <N>]` writes `export/<component>/<version>/` (gitignored) with `motion.css`, `tokens.css` and `spec.md` (`lab/lib/spec.ts`), plus `motion.gsap.js` and/or `motion.motion.js` with `--format` (`all` for both). **Export formats** (`lab/lib/export-code.ts`): **CSS** is the baseline; **GSAP** is the same motion as a timeline, easing only (seconds, `CustomEase.create` for each easing token, layers as timeline positions, `stagger` as the timeline delay, a reduced-motion branch; GSAP has no springs, so a spring version plays its easing and the code says so; transforms become `x`, `y`, `scale`, `rotation`, and one that can't convert is listed in a comment); **Motion** is the same motion with every motion a spring, built from the same `motionArgsOf` the lab plays under Motion (the version's own bounce token, else the global bounce: `--bounce 50` sets it for the file, default 25). Each is a `play<Component><Version>(el, { index })` function. The Generated CSS panel has a **Format** picker (CSS / GSAP / Motion) showing the same code. **Exports never follow the runtime.** `gsap` is a dev dependency, used only by a unit test that runs the generated GSAP code and checks its timeline against the CSS timing (duration, delay, stagger, every layer). No version = every approved version; an explicit version exports whatever its status and says so in `spec.md`. `spec.md` also lists what the lab can't verify: the production element, layout and environment, and performance.

## Token types

Tokens are **primitives only**: no composite tokens, no component-specific names. A motion step names its primitives directly, a duration plus an easing (`duration.300` + `easing.productive-standard`).

| Kind (group) | `$type` | Names | Values | CSS variable |
|---|---|---|---|---|
| `duration` | `duration` | `100 140 220 300 400 560 800 1200` | ms | `--motion-duration-300` |
| `easing` | `cubicBezier` | `productive-standard/-entrance/-exit`, `expressive-standard/-entrance/-exit`, `linear` | `[x1, y1, x2, y2]` | `--motion-easing-productive-standard` |
| `bounce` | `number` | `0 25 50` | 0, 0.25, 0.5 (Motion's own: none, its default, a clear overshoot) | `--motion-bounce-25` |
| `distance` | `dimension` | `4 8 12 16 24 32 40 48` | px | `--motion-distance-16` |
| `scale` | `number` | `60 75 90 95 96 97 98 99 103 106` | percent as a number (0.95) | `--motion-scale-95` |
| `opacity` | `number` | `04 08 10 56` | percent as a number (0.04) | `--motion-opacity-04` |
| `delay` | `duration` | `40 70 120` | ms, for short offsets and staggers (longer delays use the duration scale) | `--motion-delay-70` |

Gesture **thresholds** are part of the system but have no tokens here yet (no values were supplied).

Scale kinds are **named by their value** (`duration.300` is 300ms, `scale.95` is 95%); **easing is the one semantic layer**. Token paths use dot notation with no `motion` root; CSS variables add a `motion` prefix and drop the dots, so they can't collide with other custom properties.

**Figma mapping.** `tokens/motion.json` is shaped like the Figma variable collection it mirrors: the file is the collection (no root group) and each group is a variable group, so `easing.productive-standard` here is `easing/productive-standard` in Figma (dots become slashes). Keep names identical in both so the sync (see PLAN.md) is a straight copy. **A global scale renames tokens, so the sync must rename the existing Figma variables in place, not delete and recreate them** (recreating loses every binding in the design files): each renamed token lists its previous names in `$extensions.oldNames`, which is how the sync finds the variable to rename. Opacity and scale tokens are numbers (`0.04`, `0.95`) named by their percent (`opacity/04`, `scale/95`). The collection's description should say which scale the tokens follow (`$extensions.scale`), or Custom.


**Pairing rules** (warnings, never errors; `pairingWarnings`): productive easings pair with 100–300ms, expressive easings with 400–1200ms. Shown under "Tokens used".

**Status.** Every token is `system` (approved) or `experimental`, in `$extensions.status`. A token with no status is experimental, as **new tokens start experimental**. **A renamed or merged token keeps the highest status of the tokens folded into it** (system outranks experimental). Notes are `$description`; old names are `$extensions.oldNames` (shown with usage in the Tokens view tooltip).

**References in keyframes.** A tween keyframe value may name tokens: `translateY({distance.16})`, `{opacity.56}`, `scale({scale.95})`; a leading minus negates one (`translateY(-{distance.16})`, the "-distance-N" form). Playback resolves them to values (`resolveKeyframes`); the CSS export writes `var(--motion-distance-16, 16px)` and `calc(-1 * var(…))` for a negative; they count as usage. An unknown reference throws. Spring `properties[]` `from`/`to` are still plain numbers.

**Interactions (all 6 steps done: the model, the lab firing real events, the card example, and the plain-language summary).** A version can describe a component's **states and the transitions between them** instead of one entrance, so hover, press, focus, click and open/close can be played: `interaction: { initial, states, transitions, layers?, triggers? }` (`lab/lib/types.ts`). **Triggers** say what moves it between states and are **declared in the version, never in the markup** (a re-import of the Figma frame replaces the markup): `{ on: 'hover' | 'press' | 'focus', state, target? }` goes to `state` while it lasts and back to the state it was in when it ends (it cannot go to the resting state); `{ on: 'click', set: state, target? }` goes to a state and `{ on: 'click', toggle: [a, b], target? }` swaps; `target` is the `data-motion` name of the element the event is listened on, the component's root when left out; two triggers for the same event on the same element are refused. A trigger on an element outside the component (a button elsewhere that opens a panel) is the developer's to wire, and the spec says so (step 5). **Layers**: `layers: { image: { states: { hover: { transform: 'scale({scale.103})' } }, transitions?: {…} } }` gives a layer of the component its own values (and optionally its own timing) for the states, so a hover can lift the card while the image scales; a property a state leaves out is at its natural value there (opacity 1, no transform: `NATURAL_VALUES`; any other property must be given in every state; `partValues`, `timingFor`, `interactionParts` in `lab/lib/interaction.ts`). **`model` is optional** on an interaction version: `modelOf(version)` derives one from its first transition (a tween with that timing) for the panels that expect one, and `stepsOf` carries it (`EntranceVersion` is a version that certainly has a model, what the playback, CSS and export code works on). A **state** is a set of motion properties (opacity, transform…, token references allowed, no structural properties); a **transition is named by the state it goes TO** (`transitions.open`, `transitions.closed`), because that is how CSS, GSAP and Motion all take their timing, at the moment you move to a state. Each transition is a tween or a spring (a bounce token or number) with its own duration and easing, so going to `open` can bounce while going to `closed` is a plain exit (`productive-exit`; expressive exits paired with a short duration trip the pairing rule). (A model is no longer needed: see above.) Pure maths and plans are in `lab/lib/interaction.ts` (`validateInteraction`, `cssTransitionPlan`, `motionTransitionPlan`, `motionStates`, `describeTransition`); `lab/lib/transform.ts` splits a transform string into x, y, scale, rotate for Motion; the DOM side is `lab/lib/interaction-player.ts` (`createInteractionPlayer`: knows the current state and moves the element to another from wherever it is NOW; sets `data-state`). **In the lab** the Version panel shows a button per state, Toggle and **Interrupt** (go to the next state, then back after 150ms, before it arrives), and a click on anything marked `data-motion-set="<state>"` in the markup moves the component (the side panel's × is `data-motion-set="closed"`); Replay resets to the rest state and goes to the next one; the Playback row says what plays into each state under the current runtime; Tokens used groups tokens per transition ("into open duration") and per state ("closed transform"). **Exports:** CSS is the rest state as the class and every other state as `[data-state="…"]`, each carrying the timing into it, with a reduced-motion block (opacity still fades, movement snaps); GSAP is `states`, `transitions` and `goTo<Component><Version>(el, state)` with `overwrite: "auto"`; Motion is springs into each state. **Findings from the spike** (details in PLAN.md): Motion's duration-based springs (`visualDuration` + `bounce`) retarget from the current value but **ignore the speed of the move they cut short** (Motion's source says so; a measured −233px/s passed as `velocity` changed nothing), so velocity carry-over needs physics springs (stiffness, damping, mass); CSS retargets from the current computed value and loses the speed too; Motion's `duration: 0` instant sets are unreliable on first use, so the player sets with `duration: 0.001` and waits for it. **The lab fires the triggers for real** (`attachTriggers` in `lab/lib/interaction-player.ts`, attached wherever the component is shown: component view, page view, library): hover on `pointerenter`/`pointerleave` (a touch pointer never hovers), press on `pointerdown` until `pointerup`/`pointercancel` anywhere (the primary button only), focus on `focusin`/`focusout` for keyboard focus (`:focus-visible`) on the element or anything inside it, click on `click` (set a state, or toggle between two). **Holds**: a hover, press or focus *holds* the component in its state while it lasts; with several at once the latest wins, and when one ends it goes to the one beneath it or to the **base** state (the resting one, or what a click or the stage's buttons last set), so press-then-leave ends at rest, not at hover; going to a state with the stage's buttons makes it the new base and clears the holds. The player moves the root and every layer that has values (`data-motion="<name>"` elements inside it; a layer with no element in the markup is skipped) with the layer's own timing, from wherever each is. Stage behaviour: a version with hover, press or focus triggers **starts at rest** so it can be hovered, and **Replay** shows a hover-and-leave (goes to the first other state, then back to rest after 700ms); a version with only clicks (the side panel's open/close) plays its first move on load. The side panel's × closes it through its declared `click` trigger on the `close` layer; the old `data-motion-set` markup hook is gone. **Example:** the card's v5 "Hover Lift" (rest, hover: lifts 4px, pressed: 98%; the image is a layer that scales to 103% with its own 300ms timing; hover and press triggers). Tests: `tests/e2e/interaction-triggers.spec.ts` wires every event on stand-in elements (hover, touch ignored, press held and released elsewhere, right-click ignored, keyboard focus, click set and toggle, a layer target, detaching, a missing layer), and `tests/e2e/interactions.spec.ts` plays the card under both runtimes. **"What it does"** (Version panel, interaction versions only; `summarizeInteraction` in `lab/lib/interaction-summary.ts`, pure) says each trigger in plain words, with every part's change against rest and its timing under the current runtime (CSS: ms and easing name; Motion: ms and bounce), how the return to rest goes, and lists states no trigger leads to as set from outside. The Playback row also lists a layer's own timing (`describeTransition` takes `target`). **Trigger-aware exports (step 5).** **CSS**: rest is the class; every state is also `[data-state="…"]` (for a click or a script); hover is `:hover` inside `@media (hover: hover)`, press is `:active`, focus is `:focus-visible` / `:has(:focus-visible)`, a trigger on an inner element is `:has([data-motion="x"]:hover)` on the root; each layer is a descendant rule (`.base:hover [data-motion="image"]`) with its own timing; later rules win (focus, hover, press), the rest rule carries the way back, and the reduced-motion block lists every selector. **GSAP and Motion**: `parts` (the component, then each layer, each with `states` and `transitions`), `setup…(el)`, `goTo…(el, state)` (one tween/animation per part: an array when there are layers, one otherwise) and **`attach…(el)`**, which wires the declared triggers with the lab player's rules (touch never hovers, a press lasts until released anywhere, keyboard focus, latest hold wins, base returns) and returns a function that removes the listeners. **spec.md** has a Triggers table (event, element, what it means, what happens) and names the states set from outside the component, plus layer states and layer timing. Tests: `tests/unit/interaction-exports.test.ts` (including running the generated GSAP `attach` on stand-in nodes) and an e2e test that uses the exported CSS alone on a plain element. The designer-facing rules are under "Designing states and triggers with a designer" in the Designer workflow; later: drag, Compare for interactions, and the Figma-variant import.

**Global scale.** One setting decides how the values of the `distance`, `duration`, `delay`, `opacity` and `scale` tokens are calculated, from a ratio taken from typography (or Fibonacci): **minor third** (6:5), **major third** (5:4), **perfect fourth** (4:3), **golden ratio**, **Fibonacci**, or a custom ratio above 1 such as `1.4`. Easing and bounce are not part of it. The tokens stay value-named, so a scale gives different names (`distance.12` is 12px), and the values are still written into `tokens/motion.json`: the Figma variable collection mirrors that file, so the sync stays a straight copy. **It is opt-in**: a file with no recorded scale is **Custom** (its values were set by hand, which is the default), because applying a scale renames tokens.

- **The maths** (`lab/lib/scales.ts`, pure): `deriveKind(kind, scaleId, options)` returns the tokens (name = value, `$type`, `$value`) a scale gives one kind. Distance, duration (base 100ms, 8 steps), delay (base 40ms, 3 steps) and opacity (base 4%, 8 steps) are base × ratio^n, rounded; opacity drops steps above 100%, and distance can snap to a grid (`--snap 4`). `scale` moves around 100% in quarter-powers of the ratio (major third: 85, 89, 95 and 106, 112), and Fibonacci uses the golden ratio there. The counts match the token file, so changing the scale keeps the same number of tokens.
- **Anchored on 4px.** Most projects build on a 4px unit, so distance starts at 4px (`BASE_UNIT_PX`). Only scales that give distinct whole values from there are offered: the major second (4, 5, 5, 6…) was removed for colliding, and a test holds every scale to distinct, increasing values and names for every kind at its defaults. If two steps still round to the same value (a base that is too small for the ratio), it throws and says how to fix it; nothing is written.
- **Durations follow the scale**, so the pairing rules (productive 100–300ms, expressive 400–1200ms) are warnings against whatever values a scale gives: no scale reaches today's 1200ms top step, so expect some.
- **Applying keeps what the tokens already say.** Step i takes over from the old step i (matched by rank): it keeps that token's status and notes and records the old name in `$extensions.oldNames`; extra steps start experimental; folded steps keep the highest status. The renames are followed through the version files, so nothing dangles. Matching by rank means a scale with different spacing moves a token's *value*: the old `scale.99` becomes the new fifth step, not a 99%.
- **The recorded scale.** The scale used for each kind is saved at the root of the token file, `$extensions.scale.kinds` (`readScaleConfig` / `withScaleConfig`, `lab/lib/scale-apply.ts`). Never edit it by hand; applying a scale writes it.
- **Settings panel** (`lab/lib/scale-settings.ts`): the gear beside the theme toggle, on every view, opens Settings, since this is something you change rarely. It says what the tokens follow now (or Custom), has a select of the scales, a summary ("Major third would rename 29 tokens and change 7 version files"), a foldable "What changes" with each current token beside the one that takes its place and the versions that use it, an **Apply button** and the command for doing it by hand. Previewing writes nothing and agrees with the generator, because both use the pure code in `lab/lib/scale-apply.ts` (`applyScale`, `previewScale`).
- **Apply** asks first ("This renames 29 tokens in tokens/motion.json and edits 7 version files. Save your work first so you can go back."), then POSTs the scale to the **dev server's `/__lab/scale`** (`scripts/scale-plugin.ts`, a Vite plugin that exists only under `npm run dev`, never in a build), which calls `runScale` in `scripts/scale-run.ts`, the same code the command line uses. The endpoint accepts only a known scale (or a ratio above 1), writes only `tokens/motion.json` and the version files, works everything out before writing (a scale that doesn't fit changes nothing), and refuses a request whose Origin isn't the server's own. The files changing reloads the page, which comes back with Settings open and a one-time note of what changed. A built copy has no endpoint, so the button is off and points to the command.
- **Tests never apply for real.** The e2e tests answer the Apply POST themselves, and `tests/e2e/settings.spec.ts` refuses any apply that isn't a dry run unless a test set up its own reply, so a test cannot rewrite the real token file. If `tokens/motion.json` or a version file changes during a test run, something got through: restore them from the last save and find out why before going on.

**Using the scale (for Claude, with a designer).** A scale is a project-wide decision, not a tweak: **do not apply one unless the designer asks**. When they do, preview it first (Settings, or `--dry-run`) and say what it does in design terms ("Major third makes the spacing steps 4, 5, 6, 8, 10… and renames 29 tokens across 7 versions. Want to see how the durations change too?"), make sure their work is saved first, then apply (the button, or `npm run tokens:scale -- --all <scale>`). Afterwards run `npm run check`: tests, notes and any code that names a token by its old value (`distance.16`) may need updating, and the pairing warnings may have changed. Then say that the Figma variables need syncing (see "Figma mapping" under Token types).


**The command.** `npm run tokens:scale -- <distance|duration|delay|opacity|scale> <scale> [--base N] [--steps N] [--up N] [--snap N] [--dry-run]` and `npm run tokens:scale -- --all <scale>` (`scripts/scale-tokens.ts`) regenerate one kind, or all five, from a scale (see the file header). `--all` derives every kind before changing anything; `--dry-run` prints the new names and every rename and writes nothing; `--root <dir>` works on another checkout. Not for `easing` or `bounce`. Review the diff afterwards: pairing rules, keyframes and tests that name tokens may want a second look.

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
{ model: 'spring', duration: 'duration.300', easing: 'easing.productive-entrance', bounce: 0, delay?: 'delay.40', properties: [{ property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1 }] }
```
- The same primitives as a tween, a duration and an easing, plus an optional **`bounce`**: a bounce token (`'bounce.50'`) or a number from 0 to 1. Without one it uses the **global bounce setting**, as every tween does. Under **Motion** it plays as a real spring: the duration is Motion's `visualDuration` (when it visually arrives) and the easing is not used. Under **CSS** it plays its from/to values with the easing curve over the duration. `resolveBounce(value, raw)` in `lab/lib/motion-models.ts` resolves it.
- **The lab simulates no springs** (the spring engine is gone). A real spring is only played by a library that has one: Motion. CSS (and a GSAP export, planned) are easing only.
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
- Tween versions: `resolveTiming(v, raw)` produces a numeric `duration` > 0 (`resolveTiming` is tween-only and throws on spring versions; use `playbackOf`)
- Tween versions: `resolveTiming(v, raw)` produces a string `easing` containing `cubic-bezier`
- Token paths (e.g. `duration.300`, `easing.productive-standard`) resolve to expected concrete values

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
- **Motion**: v1 is a scaffolded default entrance (`lineage: 'imported from <figma link>'`). Imports never invent motion beyond that.
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

1. Set `status: 'review'` on the **component** (`components/<name>/motion.ts`, on the `ComponentModule`) they're submitting; the versions they're sending must already have `forkedFrom` or `lineage` set. Only mark the component `approved` or `archived` when the designer asks.
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

### Designing states and triggers with a designer

A designer says "the hover state should lift it, a click opens that" and Claude writes the version. Say it back in design terms, never in code terms ("hover lifts the card 4px and the image scales to 103%").

1. **Fork first.** A new interaction is a new version (`forkVersion`), never an edit of someone else's. The first version of a component with states usually forks the entrance and adds `interaction`.
2. **Ask only what the designer hasn't said, and never invent it:** which element reacts (the whole component, or a named layer such as the image or the close button); what each state looks like (how far, how much, fade or not); how long and how it feels (name a duration and an easing token; productive for small UI responses, expressive for large ones; exits are shorter than entrances and use productive easings); whether press and focus should look different from hover; what leaving does (back to rest, usually quicker); and, for click, whether it sets a state or toggles two. Hover on touch screens does not exist, so ask what a touch user should see if hover carries information.
3. **Write it in the version file, never in the markup.** Triggers are `interaction.triggers`; the only markup a version needs is `data-motion="<layer>"` on an inner element, and a re-import of the Figma frame **replaces the markup**, so a layer's `data-motion` name must be checked after a re-import (the lab skips a layer with no element, and "What it does" still lists it).
4. **Use tokens.** States name tokens (`translateY(-{distance.4})`, `scale({scale.98})`); a value no token has is a proposal for a new token (new tokens start experimental), not a literal.
5. **Anything outside the component is the developer's:** a button elsewhere that opens a panel has no trigger here; say so ("the open state is set from outside") and leave a state with no trigger. The spec says the same.
6. **Check it in the lab and read it back.** Open the version, hover, press and tab to it for real, try Interrupt, and read the Details panel's "What it does" aloud to the designer: if it doesn't say what they meant, the version is wrong. Try both runtimes (CSS and Motion); under Motion the timing is duration and bounce.
7. **Tell them what a developer gets:** CSS hover, press and focus work with the stylesheet alone, and the GSAP and Motion files have an `attach…` function. Set `trigger`/`reducedMotion` only when the designer has said (an interaction version's own triggers are not the entrance `trigger`).
8. **Not supported yet:** drag, physics springs and carrying speed through an interruption, Compare for interactions, and reading Figma variants as states. Say so plainly rather than approximating them.

### Rules of thumb

- Never work directly on `main`; never discard a designer's changes without asking.
- Don't edit another designer's version files; add a new version instead.
- A **global scale** renames tokens across the project: apply one only when asked, preview it first, make sure their work is saved, and say what it changed in design terms (see "Using the scale").
- If something goes wrong with saving or syncing, say what it means for their work ("Your changes are safe, but I couldn't send them yet") and fix it, rather than reporting git errors.

## Scripts

| Command              | Action                                          |
|----------------------|-------------------------------------------------|
| `npm run figma:import -- <manifest.json>` | Import a Figma frame as a component |
| `npm run spec -- <component> [version] [--format gsap\|motion\|all]` | Export motion.css, tokens.css and spec.md (plus GSAP or Motion code) for a developer |
| `npm run tokens:scale -- <kind> <scale>` or `-- --all <scale>` | Regenerate distance, duration, delay, opacity and/or scale from a scale (`--dry-run` to preview) |
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
