# Motion Lab: a brief for the Technology team

**What it is.** An internal tool for designing and reviewing website motion. Designers use it through Claude (the Claude desktop app); Claude edits a project's files and runs the lab on the designer's own Mac. It is a web app (Vite and TypeScript) that previews components and pages and exports motion specs for developers. It is not a hosted service and has no server of its own.

**What we are asking for.** A review of two decisions before designers start: (1) hosting project repositories on GitHub, which will hold client design assets (components, page layouts, images exported from Figma); (2) running the tool, including Claude and the Figma connector, on designers' Macs against that material.

## How it works

- **Where it runs.** On each designer's Mac, at `http://motionlab.localhost` (a name that only reaches the same computer). Nothing is deployed or exposed to a network. A review link or hosted copy is not part of this.
- **Where the work lives.** One Git repository per client project, plus a shared template repository (the lab's own code, with no client content). Designers work on their own branches. Changes reach `main` only through a pull request that someone approves. Only `main` is shared.
- **What Claude does.** In the Claude desktop app, Claude reads and edits the project's files, runs the lab, runs tests, commits and pushes branches. It can read Figma designs by link through the official Figma connector. A starter permissions file (`.claude/settings.json`) lets everyday commands run without a prompt and refuses `sudo`, `rm -rf`, force pushes and hard resets.
- **Accounts.** Each designer signs in with their own GitHub, Claude and Figma accounts. There are no shared logins, and no API keys or tokens in the repository.

## What leaves a designer's computer

| To | What | Why |
|---|---|---|
| GitHub | The committed project files, including images from Figma | Hosting and review |
| Anthropic (Claude) | Whatever the designer and Claude are working on: project files, Figma design content, the conversation | Claude works with the files |
| Figma | Read requests for linked frames, using the designer's own access | Importing designs |
| github.com | The designer's public avatar picture, requested by the browser when the lab opens | Shows who is on the project |
| npm and the Playwright download host | Open-source packages and test browsers, at setup | Installing the lab |

The lab itself makes no other outside requests. Fonts are served locally. There is no analytics or telemetry.

## What is on the machine

- **Dependencies.** One runtime package (`motion`, an open-source animation library) and about a dozen development tools, all pinned in a lockfile. No dependency audit has been done.
- **The dev server can write files**, but only a few: it saves a page version, applies a token scale and reads the project's git history. It accepts these requests only from the lab's own page, only in development, and a production build has none of them.
- **Setup scripts.** First-time setup may install Node through nvm, which downloads a script from GitHub, and downloads browser binaries for tests. Claude asks the designer before installing anything.
- **Licensed fonts** are never committed; designers use copies already installed on their computers.

## What we have done to limit risk

- Pull requests are required to change `main` (GitHub ruleset), with approval.
- Each designer works on a separate branch, and Claude never pushes to `main`.
- Secrets stay out of the repository by design (none are needed).
- Destructive commands are refused in the starter permissions.

## Questions for you

1. Is GitHub approved for client material, and does that need a private repo under an AREA 17 organisation, or an agreement with the client first? We would otherwise move to a self-hosted Git server (the tool has no GitHub-specific code).
2. Are Claude (Anthropic) and the Figma connector approved for client files, and are there retention terms or a data region we should require?
3. Do you want an audit of the npm dependencies, or restrictions on installing packages and browsers on designers' Macs?
4. Should access be limited by role (who can push and who approves), and is single sign-on needed for GitHub?
5. Is the designer's avatar request to github.com acceptable, or should we turn it off?

## Not in scope yet

Hosted or shareable review links, a shared service for live presence, and an automated build server. Each would need its own review.
