import type { Interaction, InteractionTrigger, MotionVersion, StateValues } from './types.js';
import { cssTransitionPlan, interactionParts, layerNames, motionTransitionPlan, partValues, resolveState, stateNames, timingFor } from './interaction.js';
import { transformParts } from './transform.js';
import { DEFAULT_BOUNCE } from './bounce.js';

// An interaction version in plain words, for a designer: "When you hover over the card, it moves up 4px
// (220ms) and the image scales to 103% (300ms). Moving off goes back to rest in 140ms." Built from the same
// version file as everything else; it describes, it never decides.

export interface SummaryLine {
  /** What starts it: "Hover", "Press", "Focus", "Click". */
  heading: string;
  /** The sentence. */
  text: string;
}

export interface InteractionSummary {
  lines: SummaryLine[];
  /** States no trigger leads to: something outside the component sets them. */
  fromOutside: string[];
  /** The summary as one block of text (what a test or a copy reads). */
  text: string;
}

const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`;
const num = (n: number): string => String(Math.round(n * 100) / 100);

// What a property does going from one value to another, in words. Empty when nothing changes.
function describeChange(prop: string, from: string | number | undefined, to: string | number): string[] {
  if (String(from) === String(to)) return [];
  if (prop === 'opacity') {
    const n = Number(to);
    return [n === 0 ? 'fades out' : n === 1 ? 'fades in' : `fades to ${pct(n)}`];
  }
  if (prop === 'transform' && typeof to === 'string') {
    const was = typeof from === 'string' ? transformParts(from).props : {};
    const { props, unsupported } = transformParts(to);
    const out: string[] = [];
    const px = (v: number | string): string => (typeof v === 'number' ? `${num(Math.abs(v))}px` : String(v).replace(/^-/, ''));
    const sign = (v: number | string): number => (typeof v === 'number' ? Math.sign(v) : String(v).startsWith('-') ? -1 : 1);
    for (const [k, v] of Object.entries(props)) {
      if (was[k] === v) continue;
      if (k === 'y') out.push(sign(v) < 0 ? `moves up ${px(v)}` : sign(v) > 0 ? `moves down ${px(v)}` : 'goes back to its place');
      else if (k === 'x') out.push(sign(v) < 0 ? `moves left ${px(v)}` : sign(v) > 0 ? `moves right ${px(v)}` : 'goes back to its place');
      else if (k === 'scale') out.push(`scales to ${pct(Number(v))}`);
      else if (k === 'scaleX') out.push(`stretches to ${pct(Number(v))} wide`);
      else if (k === 'scaleY') out.push(`stretches to ${pct(Number(v))} tall`);
      else if (k === 'rotate') out.push(`rotates ${num(Number(v))}°`);
    }
    // Something that was moved and is now not (back to rest): say so
    if (out.length === 0 && Object.keys(was).length > 0 && Object.keys(props).length === 0) out.push('goes back to its place');
    return [...out, ...unsupported.map(u => `uses ${u}`)];
  }
  return [`${prop} becomes ${String(to)}`];
}

// "the side panel", "the image": a component or a layer as a designer would say it.
const the = (name: string): string => `the ${name.replace(/-/g, ' ')}`;

// How long and how, for one part going to one state: "220ms" under CSS (with its easing), and the spring under Motion.
function timingWords(i: Interaction, target: string | null, state: string, raw: Record<string, unknown>, runtime: 'css' | 'motion', globalBounce: string): string {
  if (runtime === 'motion') {
    const p = motionTransitionPlan(i, state, raw, { target, globalBounce });
    return `${Math.round(p.options.visualDuration * 1000)}ms, bounce ${p.options.bounce}`;
  }
  const p = cssTransitionPlan(i, state, raw, { target });
  const easing = timingFor(i, target, state).easing;
  const name = (easing.includes('.') ? easing.slice(easing.indexOf('.') + 1) : easing).replace(/-/g, ' ');
  return `${Math.round(p.duration)}ms, ${name}`;
}

// What going to a state does, part by part, against the resting look: "the card moves up 4px (220ms, productive standard)".
function changesInto(i: Interaction, state: string, component: string, raw: Record<string, unknown>, runtime: 'css' | 'motion', globalBounce: string): string[] {
  const out: string[] = [];
  for (const part of interactionParts(i)) {
    let here: StateValues, rest: StateValues;
    try {
      here = resolveState(partValues(i, part, state), raw);
      rest = resolveState(partValues(i, part, i.initial), raw);
    } catch { continue; }
    const phrases = Object.entries(here).flatMap(([prop, v]) => describeChange(prop, rest[prop], v));
    if (phrases.length === 0) continue;
    out.push(`${the(part ?? component)} ${phrases.join(' and ')} (${timingWords(i, part, state, raw, runtime, globalBounce)})`);
  }
  return out;
}

// What coming back from a state to the resting one looks like: the longest it takes, and how.
function returnWords(i: Interaction, component: string, raw: Record<string, unknown>, runtime: 'css' | 'motion', globalBounce: string): string {
  const parts = interactionParts(i).filter(p => {
    try { return Object.keys(partValues(i, p, i.initial)).length > 0; } catch { return false; }
  });
  const times = parts.map(p => timingWords(i, p, i.initial, raw, runtime, globalBounce));
  const unique = [...new Set(times)];
  return unique.length === 1 ? `goes back to ${i.initial} (${unique[0]})` : `goes back to ${i.initial}: ${parts.map(p => `${the(p ?? component)} (${timingWords(i, p, i.initial, raw, runtime, globalBounce)})`).join(', ')}`;
}

const listJoin = (items: string[]): string => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

function triggerWords(t: InteractionTrigger, component: string): { heading: string; when: string } {
  const who = the(t.target ?? component);
  if (t.on === 'hover') return { heading: 'Hover', when: `When you hover over ${who}` };
  if (t.on === 'press') return { heading: 'Press', when: `While you press ${who}` };
  if (t.on === 'focus') return { heading: 'Focus', when: t.target ? `While ${who} has keyboard focus` : `While ${who}, or anything in it, has keyboard focus` };
  return { heading: 'Click', when: `When you click ${who}` };
}

export function summarizeInteraction(
  version: MotionVersion,
  raw: Record<string, unknown>,
  runtime: 'css' | 'motion',
  options: { component?: string; globalBounce?: string } = {},
): InteractionSummary {
  const i = version.interaction;
  if (!i) return { lines: [], fromOutside: [], text: '' };
  const { component = 'component', globalBounce = DEFAULT_BOUNCE } = options;
  const lines: SummaryLine[] = [];
  const led = new Set<string>();

  for (const t of i.triggers ?? []) {
    const { heading, when } = triggerWords(t, component);
    if (t.on === 'click') {
      if ('set' in t && t.set !== undefined) {
        led.add(t.set);
        const changes = changesInto(i, t.set, component, raw, runtime, globalBounce);
        // Going to the resting state has no change against rest: say how it returns instead.
        const detail = t.set === i.initial ? ` (${returnWords(i, component, raw, runtime, globalBounce).replace(/^goes back to [^ ]+ /, '').replace(/^\(|\)$/g, '')})` : changes.length ? `: ${listJoin(changes)}` : '';
        lines.push({ heading, text: `${when}, it goes to ${t.set}${detail}.` });
      } else if ('toggle' in t && t.toggle !== undefined) {
        const [a, b] = t.toggle;
        led.add(a); led.add(b);
        lines.push({ heading, text: `${when}, it switches between ${a} and ${b}. Into ${b}: ${listJoin(changesInto(i, b, component, raw, runtime, globalBounce)) || 'no visible change'}. Into ${a}: ${listJoin(changesInto(i, a, component, raw, runtime, globalBounce)) || 'no visible change'}.` });
      }
      continue;
    }
    led.add(t.state);
    const changes = changesInto(i, t.state, component, raw, runtime, globalBounce);
    const end = t.on === 'hover' ? 'Moving off' : t.on === 'press' ? 'Letting go' : 'Moving focus away';
    lines.push({ heading, text: `${when}, ${listJoin(changes) || `it goes to ${t.state}`}. ${end} ${returnWords(i, component, raw, runtime, globalBounce)}.` });
  }

  // States nothing inside the component leads to: someone outside sets them (a button that opens a panel).
  const fromOutside = stateNames(i).filter(s => s !== i.initial && !led.has(s));
  for (const s of fromOutside) {
    const changes = changesInto(i, s, component, raw, runtime, globalBounce);
    lines.push({ heading: cap(s), text: `Nothing in ${the(component)} sets ${s}: something outside does (a developer sets data-state="${s}"). ${changes.length ? `Then ${listJoin(changes)}.` : ''}`.trim() });
  }
  return { lines, fromOutside, text: lines.map(l => `${l.heading}: ${l.text}`).join('\n') };
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// The layers named in a summary, for tests and panels that want to know what it mentions.
export { layerNames };
