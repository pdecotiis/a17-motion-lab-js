import type { ComponentStatus, MotionVersion, EntranceVersion, TweenModel, SpringModel } from './types.js';
import { tokenVarName, type CompiledTokens } from './token-compiler.js';
import { buildVersionCss, orderedKeyframes } from './css-output.js';
import { getStepRefs, getTokenRefs } from './token-refs.js';
import { interactionParts, partValues, resolveState, stateNames, timingFor } from './interaction.js';
import { hasEntrance, resolveKeyframes, stepsOf } from './motion-models.js';
import { motionTableMarkdown, motionTableOf } from './motion-table.js';
import { REDUCED_MOTION_FADE_MS } from './reduced-motion.js';
import {
  STATUS_LABELS, describeLineage, describeTrigger, getReducedMotionPolicy,
  REDUCED_MOTION_LABELS,
} from './version-meta.js';

// The hand-off for one version: stack-neutral CSS, the tokens it uses, and a spec.md that
// says everything the CSS can't (when it plays, reduced motion, what the lab doesn't cover).

export interface VersionExport {
  css: string;
  tokensCss: string;
  markdown: string;
}

function parseMs(value: string): number {
  if (value.endsWith('ms')) return parseFloat(value);
  if (value.endsWith('s')) return parseFloat(value) * 1000;
  return parseFloat(value);
}

function literal(value: unknown): string {
  if (Array.isArray(value)) return `cubic-bezier(${(value as number[]).join(', ')})`;
  return String(value);
}

// "duration.base (300ms)" for a token, or the literal when the value isn't one.
function describeValue(value: string | undefined, raw: Record<string, unknown>, fallback: string): string {
  if (!value) return fallback;
  return value in raw ? `${value} (${literal(raw[value])})` : `${value} (hard-coded, not a token)`;
}

// "delay.80 (70ms)" for a token, the literal as it is otherwise.
function stagger(value: string, raw: Record<string, unknown>): string {
  return value in raw ? `${value} (${literal(raw[value])})` : value;
}

function motionLines(version: EntranceVersion, raw: Record<string, unknown>): string[] {
  const m = version.model;
  const lines = [
    `- Duration: ${describeValue(m.duration, raw, '300ms')}`,
    `- Easing: ${describeValue(m.easing, raw, 'ease')}`,
  ];
  if (m.model === 'spring') {
    const b = m.bounce === undefined ? 'the global bounce setting' : typeof m.bounce === 'string' ? describeValue(m.bounce, raw, '0') : `${m.bounce} (hard-coded, not a token)`;
    lines.push(`- Authored as a spring, bounce: ${b}. CSS plays its easing curve over the duration; only a spring runtime (Motion) bounces`);
  }
  lines.push(`- Delay: ${m.delay ? describeValue(m.delay, raw, '0ms') : '0ms'}`);
  if (version.stagger) lines.push(`- Stagger: ${stagger(version.stagger, raw)} between siblings`);
  return lines;
}

function animatedLines(version: EntranceVersion, raw: Record<string, unknown>): string[] {
  if (version.model.model === 'tween') {
    return orderedKeyframes(resolveKeyframes(version.keyframes, raw)).map(({ offset, kf }) => {
      const props = Object.entries(kf)
        .filter(([k]) => k !== 'offset' && k !== 'easing' && k !== 'composite')
        .map(([k, v]) => `${k} ${String(v)}`);
      return `- ${Math.round(offset * 1000) / 10}%: ${props.join(', ')}`;
    });
  }
  const m = version.model as SpringModel;
  return m.properties.map(p => {
    const unit = p.unit ?? '';
    const wrap = (n: number): string => (p.wrapTransform ? `${p.wrapTransform}(${n}${unit})` : `${n}${unit}`);
    return `- ${p.property}: ${wrap(p.from)} → ${wrap(p.to)}`;
  });
}

// An interaction version: its states, and the transition into each.
function stateLines(version: MotionVersion, raw: Record<string, unknown>): string[] {
  const i = version.interaction!;
  return stateNames(i).flatMap(n => {
    const values = Object.entries(resolveState(i.states[n]!, raw)).map(([k, v]) => `${k} ${String(v)}`).join(', ');
    const layerValues = interactionParts(i).filter((part): part is string => part !== null).map(part => {
      const v = Object.entries(resolveState(partValues(i, part, n), raw)).map(([k, val]) => `${k} ${String(val)}`).join(', ');
      return `  - layer \`${part}\` (the element marked data-motion="${part}"): ${v}`;
    });
    return [`- ${n}${n === i.initial ? ' (default, where it starts)' : ''}: ${values}`, ...layerValues];
  });
}

function transitionLines(version: MotionVersion, raw: Record<string, unknown>): string[] {
  const i = version.interaction!;
  return stateNames(i).flatMap(n => {
    const t = i.transitions[n]!;
    const lines = [`- **Into ${n}**: ${describeValue(t.duration, raw, '300ms')}, easing ${describeValue(t.easing, raw, 'ease')}${t.delay ? `, delay ${describeValue(t.delay, raw, '0ms')}` : ''}`];
    if (t.model === 'spring') {
      const b = t.bounce === undefined ? 'the global bounce setting' : typeof t.bounce === 'string' ? describeValue(t.bounce, raw, '0') : `${t.bounce} (hard-coded, not a token)`;
      lines.push(`  - Authored as a spring, bounce: ${b}. CSS plays the easing curve; only a spring runtime (Motion) bounces.`);
    }
    for (const part of interactionParts(i)) {
      const own = part === null ? undefined : i.layers?.[part]?.transitions?.[n];
      if (part === null || !own) continue;
      const lt = timingFor(i, part, n);
      lines.push(`  - Layer \`${part}\` has its own timing: ${describeValue(lt.duration, raw, '300ms')}, easing ${describeValue(lt.easing, raw, 'ease')}${lt.delay ? `, delay ${describeValue(lt.delay, raw, '0ms')}` : ''}`);
    }
    return lines;
  });
}

// What starts each move, and the ones the component can't start itself.
const TRIGGER_WORDS: Record<string, string> = { hover: 'pointer over it (a mouse or pen, never a touch)', press: 'pointer held down on it', focus: 'keyboard focus (not a mouse click)', click: 'a click or tap' };
function triggerLines(version: MotionVersion): string[] {
  const i = version.interaction!;
  const triggers = i.triggers ?? [];
  const led = new Set<string>();
  const rows = triggers.map(t => {
    const where = t.target ? `the element marked \`data-motion="${t.target}"\`` : 'the component itself';
    if (t.on === 'click') {
      const states = 'set' in t ? [t.set] : t.toggle;
      states.forEach(st => led.add(st));
      const what = 'set' in t ? `goes to **${t.set}**` : `swaps between **${t.toggle[0]}** and **${t.toggle[1]}**`;
      return `| click | ${where} | ${TRIGGER_WORDS['click']} | ${what} |`;
    }
    led.add(t.state);
    return `| ${t.on} | ${where} | ${TRIGGER_WORDS[t.on]} | holds **${t.state}** while it lasts, then goes back to where it was (default, or what a click set) |`;
  });
  const outside = stateNames(i).filter(n => n !== i.initial && !led.has(n));
  return [
    ...(rows.length
      ? ['| Event | On | Means | What happens |', '|---|---|---|---|', ...rows, '', 'The CSS wires hover (inside `@media (hover: hover)`), press (`:active`) and focus (`:focus-visible`) itself, and a click needs `data-state="<state>"` set by a script. The GSAP and Motion files have an `attach…(el)` function that wires all of them and returns a function that removes them. Later triggers win: a press settles over a hover.']
      : ['No triggers are declared: the component only moves when something sets `data-state="<state>"` (CSS) or calls the `goTo…` function (GSAP, Motion).']),
    ...(outside.length ? ['', `**Set from outside the component:** ${outside.map(n => `\`${n}\``).join(', ')}. Nothing inside the component leads there (for example a button elsewhere that opens a panel); the developer wires it by setting \`data-state\` or calling \`goTo…\`.`] : []),
  ];
}

function reducedMotionLines(version: MotionVersion): string[] {
  const policy = getReducedMotionPolicy(version);
  const lines = [`- ${REDUCED_MOTION_LABELS[policy]}.`];
  if (policy === 'fade') {
    lines.push(`- Movement and scale are dropped; only the opacity change plays, for at most ${REDUCED_MOTION_FADE_MS}ms.`);
  } else {
    lines.push('- The element appears in its end state.');
  }
  lines.push('- Already written into motion.css inside `@media (prefers-reduced-motion: reduce)`. A JS-driven version must honour the same rule.');
  return lines;
}

export function buildVersionExport(
  component: string,
  version: MotionVersion,
  siblings: MotionVersion[],
  tokens: CompiledTokens,
  componentStatus: ComponentStatus = 'in-progress',
): VersionExport {
  const { raw, cssVars } = tokens;
  const name = `motion-${component}-${version.id}`;
  const css = buildVersionCss(version, raw, { component });
  const layers = stepsOf(version).filter(s => s.name !== null);

  const used = getTokenRefs(version, raw).tokens;
  const varLines = used.filter(t => cssVarFor(t, cssVars)).map(t => `  ${cssVarFor(t, cssVars)};`);
  const tokensCss = varLines.length ? `:root {\n${varLines.join('\n')}\n}\n` : '/* This version uses no CSS-variable tokens. */\n';

  const trigger = describeTrigger(version.trigger);
  const status = componentStatus;
  const combined = version.interaction !== undefined && hasEntrance(version);
  // One block per element: the component's root, then each layer (a data-motion element). A preset is two
  // tracks (fade and move) on the same element, described together.
  const entries = stepsOf(version);
  const elements = [...new Set(entries.map(e => e.name))].map(n => ({ name: n, entries: entries.filter(e => e.name === n) }));
  const presetLinesFor = (el: { name: string | null; entries: typeof entries }): string[] => {
    const first = el.entries[0]!;
    const cls = el.name ? `${name}-${el.name}` : name;
    const gap = first.elementStagger ? describeValue(first.elementStagger, raw, '0ms') : undefined;
    return [
      `The **${first.preset}** preset (shared by the whole project, in \`presets/\`: \`presets.css\`, \`presets.gsap.js\`, \`presets.motion.js\`). Add \`.motion-preset-${first.preset}\`${first.version.model.delay || gap || el.name === null ? ` and \`.${cls}\` (it sets the delay${gap ? ' and the stagger' : ''})` : ''} to the element${el.name ? ` marked \`data-motion="${el.name}"\`` : ''}.`,
      ...(gap ? [`Each matching element starts ${gap} after the one before: set \`--motion-item\` to 0, 1, 2… on them (CSS); the code does it itself.`] : []),
      '',
      ...el.entries.flatMap(e => [
        `### ${e.track === 'fade' ? 'Fade' : e.track === 'move' ? 'Move' : 'Fade and move'}`,
        '',
        ...animatedLines(e.version, raw),
        ...motionLines({ ...e.version, stagger: undefined }, raw),
        '',
      ]),
    ];
  };
  const plainLines = (el: { name: string | null; entries: typeof entries }, timingHeading: string): string[] => [
    ...(el.name === null ? [] : ['### What animates', '']),
    ...animatedLines(el.entries[0]!.version, raw),
    '',
    ...(el.name === null ? [timingHeading, ''] : ['### Timing', '']),
    ...motionLines(el.name === null ? el.entries[0]!.version : { ...el.entries[0]!.version, stagger: undefined }, raw),
    '',
  ];
  const rootEl = elements.find(e => e.name === null)!;

  // The classes an element needs, as the lines above say them: a preset's own class, plus the version's class
  // when it carries the delay (always on the root).
  const classesFor = (el: { name: string | null; entries: typeof entries }): string[] => {
    const first = el.entries[0]!;
    const cls = el.name ? `${name}-${el.name}` : name;
    if (!first.preset) return [cls];
    return [`motion-preset-${first.preset}`, ...(first.version.model.delay || first.elementStagger || el.name === null ? [cls] : [])];
  };
  // For a version whose trigger is in-view the CSS does nothing until its classes are added, so the spec gives the
  // developer the observer that adds them, with the threshold and once/every-time the designer chose.
  const scrollLines = (): string[] => {
    const t = version.trigger;
    if (!t || t.on !== 'in-view' || (version.interaction && !hasEntrance(version))) return [];
    const threshold = t.threshold ?? 0;
    const once = t.once ?? true;
    const list = (cs: string[]): string => `[${cs.map(c => `'${c}'`).join(', ')}]`;
    const playFn = `play${component.split('-').map(w => w[0]!.toUpperCase() + w.slice(1)).join('')}${version.id.toUpperCase()}`;
    return [
      '### When the section scrolls into view',
      '',
      `The classes only play when they are added, so add them as the section enters the screen (${threshold ? `${Math.round(threshold * 100)}% visible` : 'as soon as any of it shows'}, ${once ? 'first time only' : 'every time it enters again'}). A sketch to adapt, where \`.your-section\` is the element the motion runs on:`,
      '',
      '```js',
      "const section = document.querySelector('.your-section');",
      `const rootClasses = ${list(classesFor(rootEl))};`,
      'const layerClasses = {',
      ...elements.filter(e => e.name !== null).map(el => `  '${el.name}': ${list(classesFor(el))},`),
      '};',
      '',
      'function setClasses(on) {',
      "  const method = on ? 'add' : 'remove';",
      '  section.classList[method](...rootClasses);',
      '  for (const [layer, classes] of Object.entries(layerClasses)) {',
      '    section.querySelectorAll(`[data-motion="${layer}"]`).forEach(el => el.classList[method](...classes));',
      '  }',
      '}',
      '',
      ...(once
        ? [
          'const observer = new IntersectionObserver(entries => {',
          '  if (!entries.some(entry => entry.isIntersecting)) return;',
          '  setClasses(true);',
          '  observer.disconnect(); // first time only',
          `}, { threshold: ${threshold} });`,
        ]
        : [
          'const observer = new IntersectionObserver(entries => {',
          '  for (const entry of entries) setClasses(entry.isIntersecting); // plays again each time it enters',
          `}, { threshold: ${threshold} });`,
        ]),
      'observer.observe(section);',
      '```',
      '',
      `On GSAP or Motion, call \`${playFn}(section)\` (from \`motion.gsap.js\` or \`motion.motion.js\`) instead of adding the classes.`,
    ];
  };
  const entranceBlock: string[] = [
    combined ? '## On appear: what animates' : '## What animates',
    '',
    ...(layers.length ? ['The component\'s root element (the one marked `data-motion-target`):', ''] : []),
    ...(rootEl.entries[0]!.preset
      ? presetLinesFor(rootEl)
      : [...animatedLines(rootEl.entries[0]!.version, raw), '', combined ? '## On appear: timing' : '## Timing', '', ...motionLines(rootEl.entries[0]!.version, raw), '']),
    // Each layer is a motion of its own: it names its own duration, easing and delay.
    ...elements.filter(e => e.name !== null).flatMap(el => [
      `## Layer: ${el.name}`,
      '',
      ...(el.entries[0]!.preset ? presetLinesFor(el) : [`Add \`.${name}-${el.name}\` to the element marked \`data-motion="${el.name}"\`.`, '', ...plainLines(el, '')]),
    ]),
    ...(combined ? ['The entrance plays first. Hover, press and focus (below) only take over when it has finished: in the CSS a hover during the entrance takes effect when it ends; in the GSAP and Motion files call `attach…(el)` once the entrance has finished.', ''] : []),
  ];
  const md: string[] = [
    `# ${component} ${version.id}: ${version.label}`,
    '',
    `Component status: ${STATUS_LABELS[status]}${status === 'approved' ? '' : ' (not approved yet, expect changes)'}`,
    `Lineage: ${describeLineage(version, siblings)}`,
    'Source: Motion Lab. The values below come from the version file; motion.css is generated from the same data.',
    '',
    '## When it plays',
    '',
    trigger ?? '**Not specified.** The designer has not said what triggers this. Ask before wiring it up.',
    '',
    // The whole motion at a glance, as the lab's Motion table shows it; the sections below say how to wire it.
    '## Motion table',
    '',
    ...motionTableMarkdown(motionTableOf(version, raw, component)),
    'Token names are written as in the lab\'s Tokens view: `duration-300` is `--motion-duration-300` (see `tokens.css`), and an easing such as `productive-standard` is `--motion-easing-productive-standard`. Easing and times are the version as authored; a spring (Motion) uses the duration as its visual duration and ignores the easing.',
    '',
    ...(version.interaction ? ['## Triggers', '', ...triggerLines(version), ''] : []),
    ...(version.interaction && !hasEntrance(version) ? [] : entranceBlock),
    ...(version.interaction ? ['## States', '', ...stateLines(version, raw), '', '## Transitions', '', ...transitionLines(version, raw), ''] : []),
    '## Reduced motion',
    '',
    ...reducedMotionLines(version),
    '',
    '## Using it',
    '',
    '1. Load `tokens.css` (or any stylesheet that defines the same custom properties) and `motion.css`.',
    combined
      ? `2. Add the class \`.${name}\` to the element when the entrance trigger fires (and each layer's class, above, to its element). The entrance plays; from then on hover, press and focus are in the CSS already, and \`data-state="<state>"\` (${stateNames(version.interaction!).join(', ')}) is for a click or anything a script decides.`
      : version.interaction
      ? `2. Add the class \`.${name}\` to the element, and keep it there for good: it is the default state. Hover, press and focus are in the CSS already; set \`data-state="<state>"\` on it (${stateNames(version.interaction).join(', ')}) for a click or anything a script decides, and the CSS transitions do the rest.`
      : `2. Add the class \`.${name}\` to the animated element when the trigger fires${layers.length ? ', and each layer\'s class (above) to its element' : ''}.`,
    ...(version.stagger ? [`3. Set \`--motion-index: 0, 1, 2…\` on each sibling to stagger them.`] : []),
    '',
    ...scrollLines().flatMap((l, i, all) => (i === all.length - 1 ? [l, ''] : [l])),
    'The CSS is plain and stack-neutral. For a project on GSAP or Motion, run `npm run spec -- <component> <version> --format gsap` (or `motion`, or `all`) for the same motion as code: `motion.gsap.js` (easing only, GSAP has no springs) and `motion.motion.js` (every motion a spring, with the bounce tokens). Both are built from the same version file and tokens as this CSS.',
    '',
    '## Tokens',
    '',
    ...tokenLines(version, raw),
    '',
    '## Not covered by this spec',
    '',
    '- **The element.** In the lab the motion runs on the element marked `data-motion-target` in the imported markup, which is a rebuild of the Figma frame, not your production DOM. Point the class at the real element.',
    '- **Layout and environment.** Real content, breakpoints, `overflow` clipping, stacking contexts and transform origin can change how the same keyframes look.',
    '- **Performance.** Not measured on a real page.',
    '',
  ];

  return { css: `${css}\n`, tokensCss, markdown: md.join('\n') };
}

// The tokens used and where: one flat list for a single motion, grouped by motion when there are layers.
function tokenLines(version: MotionVersion, raw: Record<string, unknown>): string[] {
  const steps = getStepRefs(version, raw);
  const line = (u: { token: string; where: string[] }, pad = ''): string => `${pad}- \`${u.token}\` (${u.where.join(', ')})`;
  if (steps.length === 1) return steps[0]!.uses.length ? steps[0]!.uses.map(u => line(u)) : ['- None'];
  return steps.flatMap(s => [`- **${s.layer ?? 'root'}**`, ...(s.uses.length ? s.uses.map(u => line(u, '  ')) : ['  - None'])]);
}

function cssVarFor(path: string, cssVars: Record<string, string>): string | null {
  const key = tokenVarName(path);
  return key in cssVars ? `${key}: ${cssVars[key]}` : null;
}
