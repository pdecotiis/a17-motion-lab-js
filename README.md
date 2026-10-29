# Motion Lab

A template for iterating on motion for components imported from any Figma file. Designers explore motion versions in a browser lab, compare them side by side, review them in page context, and send them for review. Claude Code handles the file and version-control work.

This repo is the **template**. All lab features are built here, and it stays client-agnostic. For client work, make a **project repo** from it (see [Template and project repos](#template-and-project-repos)).

## Quick start

Requires Node 22 (see `.nvmrc`).

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

## What the lab does

- **Library view:** every component as a scaled live preview. Hover (or focus) a card to play it, search by name, and filter by version status. Click a card to open the component.
- **Component view:** play any motion version with live controls, speed and stagger, light/dark, and side-by-side compare.
- **Page view:** an ordered list of component instances (`pages/<id>/page.json`) for reviewing motion in context. A motion map shows every version, with its state kept in the URL so it can be shared, plus saved presets.
- **Motion models:** tween and spring. Springs run a real physics simulation and compile to CSS `linear()`, with an optional cubic-bezier fallback.
- **Tokens view:** motion tokens (W3C DTCG JSON) with where each is used, tokens per version, and unused tokens flagged.
- **Version status and lineage:** each version is `in-progress`, `review`, `approved` or `archived`, and records which version it was forked from. Archived versions are hidden by default.
- **Figma import:** a close match to the Figma frame, not pixel-perfect. It checks the result against a Figma screenshot (under 5% pixel difference), and re-importing never touches motion versions.

Versions change **motion only** (`opacity`, `transform`, `filter`, `clip-path`), never structure.

## Folder structure

```
lab/            The Vite app shell (index.html, main.ts, styles.css, lib/)
components/     One folder per component: markup.html, styles.css, motion.ts, versions/
pages/          page.json files for page-level review
tokens/         motion.json (motion tokens) plus generated Figma variable files
motion-maps/    Saved presets, one JSON file per preset
scripts/        Figma importer
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
4. Import components from Figma and start exploring.

To get the latest template changes in a project repo:

```bash
git fetch template
git merge template/main
```

If `tokens/figma-variables.json`, `tokens/visual.css` or `tokens/fonts.css` conflict, don't merge them by hand. Take either side, then re-run `npm run figma:import` for each imported component to regenerate them.

## Working as a designer

Designers don't need to know git. They work through Claude Code, which creates their working space, saves, pulls in others' changes and opens reviews in plain language. The rules are in the Designer workflow section of [CLAUDE.md](CLAUDE.md).

## Previews

`npm run build` produces a static folder (`dist/`) with relative paths. Previews will be hosted on Twill as a password-protected folder upload. The publish script isn't built yet.

## Roadmap

See [PLAN.md](PLAN.md) for what's done, the decisions made, and what's next.
