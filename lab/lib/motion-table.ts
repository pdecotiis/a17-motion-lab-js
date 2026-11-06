import type { Interaction, MotionModel, MotionVersion, StateValues, TransitionTiming } from './types.js';
import { hasEntrance, resolveKeyframes, stepsOf, type StepEntry } from './motion-models.js';
import { presetTracks } from './entrance-presets.js';
import { interactionParts, partProps, partValues, resolveState, stateNames, timingFor } from './interaction.js';
import { tokenDisplayName } from './token-names.js';

// The motion table: what a version does, written the way a designer documents it by hand (the Vitrine kit's
// modal sheet, the Jane Street motion docs): one row per property an element moves, with where it starts and
// ends, the easing, the duration and the delay, and a timeline under it. It is the version as authored, so it
// does not change with the CSS / Motion runtime, and it is the same table a developer reads in the spec.
//
// Pure data here; `renderMotionTable` in lab/main.ts draws it.

export const MOTION_COLUMNS = ['Element', 'Property', 'From', 'To', 'Easing', 'Duration (ms)', 'Delay (ms)', 'Also'];
export const PRESET_COLUMNS = ['Element', 'Preset', 'Delay (ms)', 'Also'];

export interface MotionTableRow {
  cells: string[];
  /** What the author wrote where the cell shows a resolved value or a display name (a token path), by cell. */
  hints: (string | undefined)[];
}
export interface MotionTableData {
  columns: string[];
  rows: MotionTableRow[];
}
export interface MotionTrack {
  label: string;
  start: number;
  end: number;
}
export interface MotionTableSection {
  /** "entrance", "into hover". */
  title: string;
  tables: MotionTableData[];
  tracks: MotionTrack[];
  /** The timeline's length and tick spacing, in ms. */
  scale: { max: number; step: number };
}

type Raw = Record<string, unknown>;

function msOf(value: string | undefined, raw: Raw): number {
  if (value === undefined) return 0;
  const v = value in raw ? raw[value] : value;
  if (typeof v !== 'string') return typeof v === 'number' ? v : 0;
  return v.endsWith('ms') ? parseFloat(v) : v.endsWith('s') ? parseFloat(v) * 1000 : parseFloat(v);
}

const num = (n: number): string => String(Math.round(n * 100) / 100);
const isToken = (value: string, raw: Raw): boolean => value in raw;
const easingText = (easing: string, raw: Raw): string => (isToken(easing, raw) ? tokenDisplayName(easing) : easing);

function bounceNote(timing: TransitionTiming | MotionModel, raw: Raw): string | undefined {
  if (timing.model !== 'spring') return undefined;
  const b = timing.bounce;
  if (b === undefined) return 'spring, bounce is the global setting';
  if (typeof b === 'string' && b in raw) return `spring, bounce ${num(Number(raw[b]))} (${tokenDisplayName(b)})`;
  return `spring, bounce ${b}`;
}

interface Timing {
  duration: number;
  delay: number;
  easing: string;
  hints: { duration?: string; delay?: string; easing?: string };
  note?: string;
}
function timingOf(model: MotionModel | TransitionTiming, raw: Raw): Timing {
  const note = bounceNote(model, raw);
  return {
    duration: msOf(model.duration, raw),
    delay: msOf(model.delay, raw),
    easing: easingText(model.easing, raw),
    hints: {
      ...(isToken(model.duration, raw) ? { duration: model.duration } : {}),
      ...(model.delay && isToken(model.delay, raw) ? { delay: model.delay } : {}),
      ...(isToken(model.easing, raw) ? { easing: model.easing } : {}),
    },
    ...(note ? { note } : {}),
  };
}

// The properties a motion moves, each from where it starts to where it ends.
interface Move { property: string; from: string; to: string; fromHint?: string; toHint?: string; mid: string[] }

const SKIP = new Set(['offset', 'easing', 'composite']);

function movesOfModel(model: MotionModel, keyframes: Keyframe[] | undefined, raw: Raw): Move[] {
  if (model.model === 'spring') {
    const show = (p: { wrapTransform?: string; unit?: string }, v: number): string =>
      p.wrapTransform ? `${p.wrapTransform}(${num(v)}${p.unit ?? ''})` : `${num(v)}${p.unit ?? ''}`;
    return model.properties.map(p => ({ property: p.property, from: show(p, p.from), to: show(p, p.to), mid: [] }));
  }
  const authored = (keyframes ?? []) as Record<string, unknown>[];
  const resolved = resolveKeyframes(keyframes, raw) as Record<string, unknown>[];
  const props = [...new Set(resolved.flatMap(kf => Object.keys(kf).filter(k => !SKIP.has(k))))];
  return props.map(property => {
    const frames = resolved.map((kf, i) => ({ kf, i })).filter(({ kf }) => property in kf);
    const first = frames[0]!;
    const last = frames[frames.length - 1]!;
    const hint = (i: number): string | undefined => {
      const a = String(authored[i]![property]);
      return a !== String(resolved[i]![property]) ? a : undefined;
    };
    const mid = frames.slice(1, -1).map(({ kf, i }) => {
      const pct = typeof kf['offset'] === 'number' ? kf['offset'] : i / (resolved.length - 1);
      return `${num(pct * 100)}%: ${String(kf[property])}`;
    });
    const fromHint = hint(first.i);
    const toHint = hint(last.i);
    return {
      property: property === 'clipPath' ? 'clip-path' : property,
      from: String(first.kf[property]),
      to: String(last.kf[property]),
      ...(fromHint ? { fromHint } : {}),
      ...(toHint ? { toHint } : {}),
      mid,
    };
  });
}

function motionRows(element: string, moves: Move[], t: Timing, extraAlso: string[] = []): MotionTableRow[] {
  return moves.map((m, i) => {
    const also = [...(i === 0 ? extraAlso : []), ...(i === 0 && t.note ? [t.note] : []), ...m.mid];
    return {
      cells: [i === 0 ? element : '', m.property, m.from, m.to, t.easing, num(t.duration), num(t.delay), also.join(' · ')],
      hints: [undefined, undefined, m.fromHint, m.toHint, t.hints.easing, t.hints.duration, t.hints.delay, undefined],
    };
  });
}

function scaleOf(tracks: MotionTrack[]): { max: number; step: number } {
  const longest = Math.max(1, ...tracks.map(t => t.end));
  const step = [25, 50, 100, 200, 250, 500, 1000].find(s => longest / s <= 9) ?? 1000;
  return { max: Math.ceil(longest / step) * step, step };
}

const section = (title: string, tables: MotionTableData[], tracks: MotionTrack[]): MotionTableSection =>
  ({ title, tables, tracks, scale: scaleOf(tracks) });

/** The entrance: a row per property for the motions, and a row per element for the elements that use a preset. */
function entranceSection(version: MotionVersion, raw: Raw, rootLabel: string): MotionTableSection | null {
  if (!hasEntrance(version)) return null;
  const entries = stepsOf(version);
  const elementOf = (e: StepEntry): string => e.name ?? rootLabel;
  const motionRowsOut: MotionTableRow[] = [];
  const presetRowsOut: MotionTableRow[] = [];
  const tracks: MotionTrack[] = [];

  const doneElements = new Set<string>();
  for (const entry of entries) {
    const element = elementOf(entry);
    const model = entry.version.model!;
    if (entry.preset) {
      if (doneElements.has(element)) continue;
      doneElements.add(element);
      const own = entries.filter(e => e.preset && elementOf(e) === element);
      const parts = own.map(e => {
        const t = timingOf(e.version.model!, raw);
        return { label: `${e.track === 'all' ? 'motion' : e.track} ${num(t.duration)} ${t.easing}`, t };
      });
      const delay = Math.min(...parts.map(p => p.t.delay));
      const end = Math.max(...parts.map(p => p.t.delay + p.t.duration));
      const stagger = entry.elementStagger ? `each ${num(msOf(entry.elementStagger, raw))}ms after the one before` : '';
      presetRowsOut.push({
        cells: [element, entry.preset, num(delay), [...parts.map(p => p.label), stagger].filter(Boolean).join(' · ')],
        hints: [undefined, undefined, undefined, undefined],
      });
      tracks.push({ label: element, start: delay, end });
      continue;
    }
    const t = timingOf(model, raw);
    motionRowsOut.push(...motionRows(element, movesOfModel(model, entry.version.keyframes, raw), t));
    tracks.push({ label: element, start: t.delay, end: t.delay + t.duration });
  }
  const tables: MotionTableData[] = [];
  if (motionRowsOut.length) tables.push({ columns: MOTION_COLUMNS, rows: motionRowsOut });
  if (presetRowsOut.length) tables.push({ columns: PRESET_COLUMNS, rows: presetRowsOut });
  return section('entrance', tables, tracks);
}

/**
 * What a state's section is called, in the words of the kit's button sheet: "hover on", "hover off", "pressed".
 * Arriving at a state a hover or focus trigger holds is "hover on" or "focus on"; any other state is called by its
 * name ("pressed", "open"). Going back to the initial state is "hover off" when a hover trigger leads away from it
 * (else "focus off" for a focus trigger), and has no section otherwise: there is no "back to default", and a click
 * that closes something will be an "exit" when exits are documented. Null means the state has no section.
 */
export function stateHeading(interaction: Interaction, state: string): string | null {
  const triggers = interaction.triggers ?? [];
  if (state !== interaction.initial) {
    const t = triggers.find(x => x.on !== 'click' && 'state' in x && x.state === state);
    if (t?.on === 'hover') return 'hover on';
    if (t?.on === 'focus') return 'focus on';
    return state;
  }
  if (triggers.some(t => t.on === 'hover')) return 'hover off';
  if (triggers.some(t => t.on === 'focus')) return 'focus off';
  return null;
}

/** Going to a state: what each part (the component, then each layer) changes, from the state it comes from. */
function stateSections(version: MotionVersion, raw: Raw, rootLabel: string): MotionTableSection[] {
  const interaction = version.interaction;
  if (!interaction) return [];
  // The order a designer reads them in: the way back ("hover off") right after the state that leads away ("hover on").
  const others = stateNames(interaction).filter(n => n !== interaction.initial);
  const away = others.findIndex(n => /^(hover|focus) on$/.test(stateHeading(interaction, n) ?? ''));
  const states = away === -1 ? [...others, interaction.initial] : [...others.slice(0, away + 1), interaction.initial, ...others.slice(away + 1)];
  return states.flatMap(state => {
    const title = stateHeading(interaction, state);
    if (title === null) return [];
    const from = state === interaction.initial ? states.find(s => s !== interaction.initial) ?? interaction.initial : interaction.initial;
    const rows: MotionTableRow[] = [];
    const tracks: MotionTrack[] = [];
    for (const part of interactionParts(interaction)) {
      if (partProps(interaction, part).length === 0) continue;
      const before: StateValues = resolveState(partValues(interaction, part, from), raw);
      const after: StateValues = resolveState(partValues(interaction, part, state), raw);
      const moves: Move[] = Object.keys(after)
        .filter(p => String(before[p]) !== String(after[p]))
        .map(p => ({ property: p === 'clipPath' ? 'clip-path' : p, from: String(before[p]), to: String(after[p]), mid: [] }));
      if (moves.length === 0) continue;
      const t = timingOf(timingFor(interaction, part, state), raw);
      const element = part ?? rootLabel;
      rows.push(...motionRows(element, moves, t, [`from ${from}`]));
      tracks.push({ label: element, start: t.delay, end: t.delay + t.duration });
    }
    return rows.length ? [section(title, [{ columns: MOTION_COLUMNS, rows }], tracks)] : [];
  });
}

/**
 * The version's motion table: the entrance (when it has one) and, for each state it can go to, what changes.
 * `rootLabel` names the component's root in the Element column and the timeline (the component's name).
 */
export function motionTableOf(version: MotionVersion, raw: Raw, rootLabel = 'component'): MotionTableSection[] {
  const entrance = entranceSection(version, raw, rootLabel);
  return [...(entrance ? [entrance] : []), ...stateSections(version, raw, rootLabel)];
}

// ── The same table as Markdown (spec.md) ───────────────────────────────────

const mdCell = (text: string, i: number, strongFirst: boolean, last: boolean): string => {
  const safe = text.replace(/\|/g, '\\|');
  if (!safe) return '';
  if (i === 0 && strongFirst) return `**${safe}**`;
  return last ? safe : `\`${safe}\``;
};

// The timeline as text: a bar per element on a ruler, 40 characters across.
function timelineText(sec: MotionTableSection): string[] {
  const width = 40;
  const { max } = sec.scale;
  const col = (ms: number): number => Math.round((ms / max) * width);
  const pad = Math.max(...sec.tracks.map(t => t.label.length));
  return [
    ...sec.tracks.map(t => {
      const from = col(t.start);
      const to = Math.max(from + 1, col(t.end));
      return `${t.label.padEnd(pad)}  ${' '.repeat(from)}${'█'.repeat(to - from)}${' '.repeat(width - to)}  ${num(t.start)}–${num(t.end)}ms`;
    }),
    `${' '.repeat(pad)}  0${' '.repeat(width - String(max).length - 3)}${max}ms`,
  ];
}

/** The tables and timelines as Markdown lines, for spec.md. */
export function motionTableMarkdown(sections: MotionTableSection[]): string[] {
  if (sections.length === 0) return [];
  return sections.flatMap(sec => [
    `### ${sec.title}`,
    '',
    ...sec.tables.flatMap(data => [
      `| ${data.columns.join(' | ')} |`,
      `| ${data.columns.map(() => '---').join(' | ')} |`,
      ...data.rows.map(r => `| ${r.cells.map((c, i) => mdCell(c, i, true, i === data.columns.length - 1)).join(' | ')} |`),
      '',
    ]),
    '```',
    ...timelineText(sec),
    '```',
    '',
  ]);
}
