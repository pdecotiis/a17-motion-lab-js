# motion-lab (plugin)

One skill, `/motion-lab:setup`: sets up Motion Lab on a designer's Mac from nothing. The source of truth is `.claude/skills/motion-lab-setup/SKILL.md` in the template; this folder is a copy with the skill named `setup`, so the command is short. `tests/unit/setup-plugin.test.ts` fails if the two drift apart. After changing the skill, copy it here again and publish a new version (bump `version` in `.claude-plugin/plugin.json`).
