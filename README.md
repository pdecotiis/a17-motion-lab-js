# Motion Lab

A template for iterating on motion for components imported from any Figma file. Designers explore motion versions in a browser lab, compare them side by side, review them in page context, and send them for review. Claude Code handles the file and version-control work.

This repo is the **template**. All lab features are built here, and it stays client-agnostic. For client work, make a **project repo** from it (see [Template and project repos](#template-and-project-repos)).

## Quick start

Requires **Node 22.12 or newer** (see `.nvmrc`; `package.json` says it too, so `npm install` stops with a clear message on an older one). Not sure the computer is ready? `npm run doctor` checks Node, the packages, Git, the test browsers and the client fonts, and says in plain words what to do about each. `npm run dev` and `npm run check` run the part they need first.

```bash
nvm use
npm install
npx playwright install   # first time only, for the E2E tests
npm run dev
```

The lab opens at http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Start the lab |
| `npm run build` | Build to `dist/` with relative paths |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E tests (Chromium and WebKit) |
| `npm run check` | typecheck + test + build + test:e2e. Must pass before work is done |
| `npm run figma:import -- <manifest.json>` | Import a Figma frame as a component |
| `npm run figma:import-page -- <manifest.json>` | Make a page from a Figma page frame whose sections are imported |

## What the lab does

- **Library view:** every component as a scaled live preview. Hover (or focus) a card to play it, search by name, and filter by version status. Click a card to open the component.
- **Component view:** play a motion version with speed and stagger, light/dark, and side-by-side compare. It shows the tokens each motion uses and where (the card and its text can use different ones). There are no controls: a motion change is a new version.
- **Page view:** an ordered list of component instances (`pages/<id>/page.json`) for reviewing motion in context, shown in a fixed-height window you scroll, so a version that plays when its section scrolls into view (an `in-view` trigger) waits until it does. A **page version** is a saved combination (which version of each component plays where, plus the stagger) in `pages/<id>/versions/`; switch between them, compare two side by side (fitted to the window with the scale shown, or at actual size), and save the current one as a new version. A single page is always shown at its exact Figma size. Unsaved changes live in the URL, so they can be shared.
- **Motion models:** tween and spring. The lab plays with CSS or Motion (motion.dev), chosen in Settings, and never mixes them: CSS plays easing curves for every motion, Motion plays springs for every motion (a tween plays as a spring with the global bounce setting, shown under Motion only). Under CSS a version authored as a spring plays and exports its from/to values with its easing.
- **Export:** the Generated code panel and `npm run spec` give a developer the same motion as CSS, GSAP (easing only) or Motion (springs), from the same version file and tokens. The runtime you preview with never changes what is exported.
- **Settings:** the gear beside the theme toggle opens the global scale: pick a typographic scale (minor third, major third, perfect fourth, golden ratio, Fibonacci), preview what it would rename, and apply it. It derives the distance, duration, delay, opacity and scale tokens from one ratio, anchored on 4px. Applying needs the dev server (`npm run dev`) or `npm run tokens:scale -- --all <scale>`.
- **Tokens view:** motion tokens (W3C DTCG JSON) with where each is used, tokens per version, and unused tokens flagged.
- **Version status and lineage:** each version is `in-progress`, `review`, `approved` or `archived`, and records which version it was forked from. Archived versions are hidden by default.
- **Figma import:** a close match to the Figma frame, not pixel-perfect. It checks the result against a Figma screenshot (under 5% pixel difference), and re-importing never touches motion versions.

Versions change **motion only** (`opacity`, `transform`, `filter`, `clip-path`), never structure.

## Folder structure

```
lab/            The Vite app shell (index.html, main.ts, styles.css, lib/)
components/     One folder per component: markup.html, styles.css, motion.ts, versions/
pages/          One folder per page: page.json, and versions/ with its page versions
tokens/         motion.json (motion tokens), presets.json, generated Figma variable files; a project's own, a template merge never overwrites them
scripts/        Figma importers (component and page), spec export, scale tools
tests/          unit/ (Vitest) and e2e/ (Playwright)
```

[CLAUDE.md](CLAUDE.md) is the full reference: how to add components and versions, token types, motion model rules, testing rules, Figma import rules and the designer workflow.

## Template and project repos

| | Template repo (this one) | Project repo |
|---|---|---|
| Holds | Lab features, tooling, docs, a sample component | Client components, versions, pages, presets, assets, baselines |
| Built here | Features and fixes | Nothing. It never builds features |
| Client content | None | All of it |

To start a project:

1. Create the project repo from this template and clone it.
2. Add this repo as a remote so you can pull updates:
   ```bash
   git remote add template git@github.com:pdecotiis/a17-motion-lab.git
   ```
3. Add the client's fonts to `/fonts` (gitignored). Faces with no matching file fall back to a system font.
4. Delete the template's sample content, which a project doesn't keep: `components/card`, `components/side-panel` and `pages/home`. The tests that need them skip themselves (see `tests/samples.ts`), and the lab opens your first component and page.
5. Name the project: add `project.json` at the repo root, `{ "name": "Jane Street" }`. The header then says "Jane Street · Motion Lab" and the tab title ends with it, which matters when you share the lab with the client. The template has none (it says just "Motion Lab"), so a merge never touches yours; restart the dev server once after adding it.
6. Import components from Figma and start exploring.

To get the latest template changes in a project repo:

```bash
git fetch template
git merge -X no-renames template/main
```

`-X no-renames` matters in a project that deleted the sample content (step 4): without it git can mistake a deleted folder for a rename and apply the template's changes to the wrong component. If the template changed a sample file you deleted (`components/card`, `components/side-panel`, `pages/home`), git reports a conflict or adds the new file back; keep them deleted (`git rm -f <file>`), then `git commit`. Run `npm run check` afterwards.

### The token files are the project's own

The template's tokens (`tokens/motion.json`, the Vitrine starter set) and presets (`tokens/presets.json`) are a **starting point**. Once a project is made from the template they belong to it: change them freely. So a merge from the template never overwrites them: `.gitattributes` gives these files (`motion.json`, `presets.json`, `figma-variables.json`, `visual.css`, `fonts.css`) a merge driver that keeps the project's own version, and `npm install` switches the driver on (`scripts/setup-git.mjs`, run by `postinstall`). Run `npm install` once in a fresh clone before merging; in a project repo `npm run check` fails if the driver is not set, and a test proves the driver works on throwaway repos.

Nothing in the lab names a token that a project might change: the default page stagger is the middle delay token, and the Figma import scaffolds its first version from the closest duration, distance and easing the project has. The template's own tests that pin its token values run only in the template (they skip in a project, like the sample content).

To take a template token change on purpose (the template moved its starter set, say), do it by hand, so you decide:

```bash
git checkout template/main -- tokens/motion.json tokens/presets.json   # or just the file you want
npm run tokens:remap -- --renames tokens/migrations/<name>.renames.json   # point your versions at the new names
npm run check
```

`tokens/migrations/` in the template holds each such change (the spec and the renames it wrote). Without a renames file, `npm run tokens:remap -- <spec.json>` moves a project's own tokens to a new set by nearest value.

## Working as a designer

Designers don't need to know git. They work through Claude Code, which creates their working space, saves, pulls in others' changes and opens reviews in plain language. The rules are in the Designer workflow section of [CLAUDE.md](CLAUDE.md).

## Previews

`npm run build` produces a static folder (`dist/`) with relative paths. Previews will be hosted on Twill as a password-protected folder upload. The publish script isn't built yet.

## Roadmap

See [PLAN.md](PLAN.md) for what's done, the decisions made, and what's next.
