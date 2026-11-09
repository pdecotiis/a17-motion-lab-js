# Getting started with Motion Lab

For designers. You work with Claude in the Claude desktop app; it does the technical parts for you. You don't need to know git, Node or the terminal. Allow about 20 minutes the first time, most of it waiting for downloads.

## Project details (filled in once per project, by whoever sets it up)

| | |
|---|---|
| Project | Jane Street |
| Where the code lives | GitHub: `https://github.com/pdecotiis/a17-motion-lab-js.git` |
| Who to ask for access or help | Paul DeCotiis, on Slack or by email |

## Before you start

You need three things. If one is missing, ask the person above.

1. **The Claude desktop app** on your Mac, signed in with your own Claude account (the one with Claude Code access). Download it from claude.ai/download.
2. **Access to the project's code.** You'll get an invitation by email from our git host. Accept it and sign in. (Claude can't do this part for you.)
3. **The Figma connector** connected in Claude, with access to the client's Figma file. You probably have this already; if Claude can't see a Figma link, it will tell you.

## Set up (once, on each computer)

1. In your Documents folder, make an empty folder called **Motion Lab**. (The project goes in a folder inside it.)
2. Open the Claude desktop app, go to the **Code** tab, and open that folder.
3. If your Claude has the **Motion Lab setup** skill (your admin will say), just type `/motion-lab:setup` and give it the address from the table above. Otherwise paste this and send it, filling in the address:

   > Set up Motion Lab for me. The project's code is at **\<the address\>**. Put it in a folder of its own inside this one, check my computer is ready, fix anything that is missing, and open the lab. I'm not technical, so tell me what you're doing in plain words and ask before you install anything.

4. Claude will check your Mac and walk you through what it needs. Usually:
   - **Apple's developer tools.** macOS offers to install them; say yes and wait a few minutes. (If Claude says Xcode's licence needs accepting, it gives you one line to run in Terminal; it needs your Mac password, which only you type.)
   - **A way to sign in to the code host.** Claude will explain it and set it up with you (a one-time key or token; you'll approve it in your browser). Keep what it shows you private.
   - **Node**, the engine the lab runs on. Claude installs the right version.
   - **The project's packages**, a download of a few hundred MB.
   - **Test browsers**, another few hundred MB. Claude does this early so you're not stopped at the end.
5. The lab opens in the preview pane, at `motionlab.localhost` (a private address that only your own computer can reach), with a 🧪 in the tab. If it does, you're done.

## Every day

Open the Claude desktop app, open your Motion Lab folder in the **Code** tab, and say what you want to explore ("let's try a slower entrance for the hero"). Claude starts the lab, makes a safe copy for your work, and shows you the result.

- **"Save this"**: Claude saves your work with a description of what changed and says so.
- **"Ready for review"**: Claude checks everything, sends your work to the project and gives you a link for your reviewers.
- **"Start something new"**: Claude starts a fresh copy so your earlier work stays put.

You never need to say "commit", "branch" or "merge". If you do, Claude will mirror you.

## Working with other designers

Several designers can work on the same project at once. Each of you works on your own copy, so you can't break each other's work, and your work meets the others' when you say "Ready for review" (a reviewer approves it into the shared project).

- **Your own copy.** Claude starts every exploration on a copy named for you and keeps it separate until it is reviewed.
- **Who else is here.** The avatars beside the light/dark switch show everyone who has ever worked in the project, you first. Hover one to see when they last worked.
- **Claude tells you about overlap.** Before you start on a component, Claude checks whether a teammate already has work in review on it and says so. Work someone has saved only on their own Mac can't be seen, so ask each other if you're about to touch the same thing.
- **When you meet.** Claude brings in the latest shared work before saving or sending yours. It settles easy overlaps itself and asks you only when you and a teammate changed the same motion value or look.
- **One owner per Figma frame.** Re-importing a frame replaces its markup and styles, so agree who imports it.

## If something goes wrong

- **Something stops with an error:** copy the whole message and paste it to Claude. It reads the error, so you don't have to.
- **The lab won't open:** say "check my setup". Claude runs a check that says in plain words what's wrong and fixes it, asking first.
- **The text looks different from the client's font:** the client's fonts aren't in the code. If you have them installed, tell Claude and it can use them; otherwise the lab uses a stand-in font and says so.
- **You can't sign in to the code host or Claude can't see your files:** ask the person in the table above.
- **Your work looks lost:** it isn't. Say "show me what I've saved" and Claude lists it.

## For whoever sets up access (not designers)

Do this once per designer and project:

- [ ] **Invite the designer** to the project on the git host, with a role that can send work to the project but **not change protected branches**: they save to their own branches and a reviewer approves. Developer level, or the host's equivalent.
- [ ] **Protect the main branch**, so nothing reaches it without review.
- [ ] **Single sign-on or VPN:** if the host needs either, tell the designer before they start and add it to the table above.
- [ ] **Sign-in method:** the designer needs a personal access token or an SSH key. A token with permission to read and write the repository (and, if Claude should open merge or pull requests, the API scope) and a sensible expiry is the least trouble. Claude walks them through creating it.
- [ ] **Fill in the table at the top** of this file in the project's copy, and `project.json` at the repository's root with the client's name.
- [ ] **Fonts (optional):** if the client's fonts are licensed to us, say where designers get them. The lab works without them.
- [ ] **Figma access:** the designer's Figma account can open the client's file.

Claude's own sign-in and the Figma connector belong to each designer's account; nobody shares one.
