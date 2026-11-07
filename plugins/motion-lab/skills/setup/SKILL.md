---
name: setup
description: Set up Motion Lab on a designer's Mac from nothing (first run, a new computer, or "the lab won't start"): git, signing in to the code host, cloning the project, the right Node, packages and test browsers, then opening the lab. Use when a designer says "set up Motion Lab", "get me started", "I'm new", "new laptop", or the lab or doctor reports something missing.
---

# Motion Lab setup

You are setting up a **designer's Mac** so they can work in Motion Lab. They are not technical and have no command-line tools installed. They work only through you, so you do everything, in plain words, one thing at a time.

## Rules

- **Plain words only.** Say what you are doing and why in one sentence ("I'm installing the engine the lab runs on"). Never paste raw errors at them: read the error yourself and explain it.
- **Ask before you install or change anything**, once per item, then do it. Do one thing at a time and say when it is done.
- **Never use `sudo`.** Everything here works without it.
- **Never ask for, type, store or repeat a password, token or private key.** The sign-in below uses an SSH key: you create it, show only the public half, and they paste that into the code host in their browser.
- **Mac only.** If this is not macOS, say so and stop.
- **Don't edit `.npmrc`, `engines` or `.nvmrc` to get past an error.** Fix the cause.
- Don't use git words (branch, commit, push, merge) unless the designer does first.

## Before you start

Two things come from the designer or the project's details (the table at the top of `ONBOARDING.md`):
- **The project's address** (the git clone address). If you were not given it, ask for it: "What is the project's address? It's in the welcome note you were sent."
- **Their name and work email**, for the first-time sign-in. Ask once.

Work in the folder you were opened in. If it already holds the project (there is a `package.json` and `components/`), skip to **Check the machine** and treat this as a repair.

## 1. Look at the machine (read-only)

Run these and keep the results; don't change anything yet.

```bash
uname -s                     # Darwin
git --version                # on a Mac with no developer tools this makes macOS offer to install them
ls ~/.nvm/nvm.sh 2>/dev/null # is nvm there?
node -v 2>/dev/null          # which Node, if any
git config --global user.name; git config --global user.email
ls ~/.ssh 2>/dev/null
```

Then tell the designer, in a short list, what is already fine and what you need to do ("Your Mac needs: Apple's developer tools, a sign-in to the code host, the engine the lab runs on, and the project's packages. About 20 minutes, mostly downloads."). Ask: "Shall I go ahead, one step at a time?"

## 2. Apple's developer tools (gives you `git`)

If `git --version` opened a macOS dialog or failed, ask them to click **Install** in it and wait a few minutes. Run `git --version` again until it prints a version.

## 3. Sign in to the code host (an SSH key)

1. **Their name for the project's history.** If `git config --global user.name` or `user.email` is empty, set them with the name and email they gave:
   `git config --global user.name "…"` and `git config --global user.email "…"`.
2. **A key.** If there is no key made for this (no `~/.ssh/id_ed25519_motionlab`), make one with no passphrase:
   `ssh-keygen -t ed25519 -C "<their email>" -f ~/.ssh/id_ed25519_motionlab -N ""`
3. **Tell git to use it for this host.** From the project's address work out the host (the part after `@` and before `:`, or between `//` and the next `/`), and add to `~/.ssh/config` (create it if needed; don't remove what is there):
   ```
   Host <the host>
     IdentityFile ~/.ssh/id_ed25519_motionlab
     IdentitiesOnly yes
     AddKeysToAgent yes
     UseKeychain yes
   ```
4. **They add the public half in the browser.** Show **only** the contents of `~/.ssh/id_ed25519_motionlab.pub` (run `pbcopy < ~/.ssh/id_ed25519_motionlab.pub` so it is on their clipboard too). Walk them through it: open the code host in their browser, sign in (with the invitation they accepted), find **SSH Keys** in their profile settings, paste the key, give it a name like "Motion Lab, my Mac", save.
5. **Test it.** `ssh -o StrictHostKeyChecking=accept-new -T git@<the host>`. A welcome message with their name means it works. If it says permission denied, the key isn't added or the invitation isn't accepted yet: say which, and wait.

If the host needs a VPN or single sign-on and they can't reach it, say so plainly and tell them to ask the person named in `ONBOARDING.md`.

## 4. Get the project

- If the current folder is empty: `git clone <the address> .`
- If it has other things in it (apart from `.claude`): `git clone <the address> motion-lab` and say you'll work in that folder from now on.

If the clone says the repository isn't found or access is denied, the invitation isn't accepted or their role is missing: say that, don't try workarounds.

Then `cd` into the project and read `CLAUDE.md` once: from here on it is your rulebook (including "Designer workflow").

## 5. Node and the project's packages

1. **Node.** `.nvmrc` says which version. If `nvm` is missing, ask, then install it with the official script from `https://github.com/nvm-sh/nvm` (the install command in its README), and load it in this shell: `source ~/.nvm/nvm.sh`. Then `nvm install` (reads `.nvmrc`) and `nvm use`. Confirm with `node -v`.
2. **Packages.** Ask, then `npm install` (a few hundred MB; it also switches on the merge protection for the token files).
3. **Test browsers.** Ask, then `npx playwright install chromium webkit` (a few hundred MB, once per computer). Do it now: they are needed before work is sent for review, and it is worse to stop at the end.

## 6. Check, then open the lab

1. Run `npm run doctor -- --json` and read it as `CLAUDE.md` says ("First run on a new machine"): fix what you can (asking first), name who can fix the rest (the **client fonts** and the **Figma connector** are the usual ones), and run it again until `ready` is true. Warnings don't block.
2. Start the lab with the **preview** tool (the project's `.claude/launch.json` has the dev server; never run a dev server through a plain shell command) and open it in the browser pane.
3. Greet them with what is ready, not with the setup details: "The lab is open. What would you like to explore first?" Then follow **Session start** in `CLAUDE.md` (their first name, what they want to explore, a safe copy named for them).

## If something fails

- Say in one sentence what it means for them ("Your changes are safe; I couldn't download the browsers yet. It's probably the connection."), try the obvious fix once, and if it still fails, stop and tell them who to ask (the person named in `ONBOARDING.md`) and exactly what to send them.
- **"Unsupported engine"** or **"The lab can't start yet"** means the wrong Node: go back to step 5.
- **Disk or permission errors** on the Mac itself: stop and say so; don't try to fix system settings.
- A step that already works is skipped, not redone: this skill is safe to run again whenever the lab won't start.
