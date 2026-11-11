# Project triggers

A trigger is what moves a component between its states (hover, press, focus, click, the arrow keys). Those are the lab's own, and they export to plain CSS.
Anything else this project needs ("step to the next state every five seconds") is a **project trigger**: one file here, `triggers/<name>.ts`, which
default-exports a `ProjectTrigger`. It is found automatically, and a merge from the template never touches this folder.

The contract (what to export, what the player gives you, and what to write for the GSAP and Motion export) is documented at the top of
`lab/lib/project-triggers.ts`. A version then uses it by name: `{ on: '<name>', ...its own settings }`.
