import { describe, it, expect } from 'vitest';
import { motionTableOf, motionTableMarkdown, MOTION_COLUMNS, PRESET_COLUMNS } from '../../lab/lib/motion-table.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import { PRESET_NAMES } from '../../lab/lib/entrance-presets.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup, MotionVersion } from '../../lab/lib/types.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

// Fixtures use only the system's tokens, so they hold in any project.
const tween: MotionVersion = {
  id: 'v1', label: 'Fade up', lineage: 'test',
  model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance' },
  keyframes: [
    { opacity: 0, transform: 'translateY({distance.16})', offset: 0 },
    { opacity: 0.5, offset: 0.4 },
    { opacity: 1, transform: 'translateY(0)', offset: 1 },
  ],
  layers: {
    title: {
      model: { model: 'tween', duration: 'duration.220', easing: 'easing.productive-entrance', delay: 'delay.70' },
      keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }],
    },
  },
};

describe('the motion table of an entrance', () => {
  const [entrance] = motionTableOf(tween, raw, 'card');
  const rows = entrance!.tables[0]!.rows;

  it('is one section named entrance with the full set of columns', () => {
    expect(motionTableOf(tween, raw, 'card')).toHaveLength(1);
    expect(entrance!.title).toBe('entrance');
    expect(entrance!.tables[0]!.columns).toEqual(MOTION_COLUMNS);
  });

  it('has a row per property, the element named once, token values resolved', () => {
    expect(rows.map(r => r.cells.slice(0, 4))).toEqual([
      ['card', 'opacity', '0', '1'],
      ['', 'transform', 'translateY(16px)', 'translateY(0)'],
      ['title', 'opacity', '0', '1'],
    ]);
  });

  it('writes easing as the display name and times in ms, and keeps the authored token as a hint', () => {
    expect(rows[0]!.cells.slice(4, 7)).toEqual(['productive-entrance', '300', '0']);
    expect(rows[0]!.hints[4]).toBe('easing.productive-entrance');
    expect(rows[0]!.hints[5]).toBe('duration.300');
    expect(rows[2]!.cells.slice(4, 7)).toEqual(['productive-entrance', '220', '70']);
    expect(rows[2]!.hints[6]).toBe('delay.70');
    expect(rows[1]!.hints[2]).toBe('translateY({distance.16})');
  });

  it('lists a frame between the first and last under Also', () => {
    expect(rows[0]!.cells[7]).toBe('40%: 0.5');
  });

  it('has a timeline bar per element, from its delay to where it ends', () => {
    expect(entrance!.tracks).toEqual([
      { label: 'card', start: 0, end: 300 },
      { label: 'title', start: 70, end: 290 },
    ]);
    expect(entrance!.scale.max).toBeGreaterThanOrEqual(300);
    expect(entrance!.scale.max % entrance!.scale.step).toBe(0);
  });
});

describe('a spring', () => {
  const spring: MotionVersion = {
    id: 'v1', label: 'Pop', lineage: 'test',
    model: {
      model: 'spring', duration: 'duration.300', easing: 'easing.productive-entrance', bounce: 'bounce.50',
      properties: [{ property: 'transform', wrapTransform: 'scale', from: 0.92, to: 1 }],
    },
  };
  it('writes its from and to, and says it is a spring with its bounce', () => {
    const row = motionTableOf(spring, raw, 'badge')[0]!.tables[0]!.rows[0]!;
    expect(row.cells.slice(0, 4)).toEqual(['badge', 'transform', 'scale(0.92)', 'scale(1)']);
    expect(row.cells[7]).toBe('spring, bounce 0.5 (bounce-50)');
  });
});

describe('a preset', () => {
  const preset = PRESET_NAMES[0]!;
  const v: MotionVersion = {
    id: 'v1', label: 'Preset', lineage: 'test',
    entrance: { preset },
    layers: { title: { preset, delay: 'delay.70', stagger: 'delay.40' } },
  };
  const [entrance] = motionTableOf(v, raw, 'hero');
  it('gets a row per element in the preset table, with the preset, its delay and its stagger', () => {
    const table = entrance!.tables.find(t => t.columns === PRESET_COLUMNS)!;
    expect(table.rows.map(r => r.cells.slice(0, 3))).toEqual([['hero', preset, '0'], ['title', preset, '70']]);
    expect(table.rows[1]!.cells[3]).toContain('each 40ms after the one before');
    expect(table.rows[0]!.cells[3]).toMatch(/(fade|motion) \d+/);
  });
  it('has one timeline bar per element', () => {
    expect(entrance!.tracks.map(t => t.label)).toEqual(['hero', 'title']);
    expect(entrance!.tracks[1]!.start).toBe(70);
  });
});

describe('states', () => {
  const states: MotionVersion = {
    id: 'v1', label: 'Hover', lineage: 'test',
    interaction: {
      initial: 'rest',
      states: { rest: {}, hover: { transform: 'translateY(-{distance.4})' } },
      transitions: {
        rest: { model: 'tween', duration: 'duration.140', easing: 'easing.productive-exit' },
        hover: { model: 'tween', duration: 'duration.220', easing: 'easing.productive-standard' },
      },
    },
  };
  const sections = motionTableOf(states, raw, 'card');

  it('has no entrance when the version has none, and a section for each state with something to move', () => {
    expect(sections.map(s => s.title)).toEqual(['into rest', 'into hover']);
  });
  it('goes from the state it comes from to the state it goes to', () => {
    const hover = sections[1]!.tables[0]!.rows[0]!;
    expect(hover.cells.slice(0, 7)).toEqual(['card', 'transform', 'none', 'translateY(-4px)', 'productive-standard', '220', '0']);
    expect(hover.cells[7]).toBe('from rest');
    const rest = sections[0]!.tables[0]!.rows[0]!;
    expect(rest.cells.slice(2, 4)).toEqual(['translateY(-4px)', 'none']);
    expect(rest.cells.slice(4, 6)).toEqual(['productive-exit', '140']);
    expect(rest.cells[7]).toBe('from hover');
  });
});

describe('the Markdown table (spec.md)', () => {
  const lines = motionTableMarkdown(motionTableOf(tween, raw, 'card'));
  it('has a heading, a header row, a rule, and a row for every row of the table', () => {
    expect(lines[0]).toBe('### entrance');
    expect(lines[2]).toBe(`| ${MOTION_COLUMNS.join(' | ')} |`);
    expect(lines[3]).toBe(`| ${MOTION_COLUMNS.map(() => '---').join(' | ')} |`);
    expect(lines.filter(l => l.startsWith('| ')).length).toBe(2 + 3);
  });
  it('names the element in bold once, and writes values as code', () => {
    expect(lines).toContain('| **card** | \`opacity\` | \`0\` | \`1\` | \`productive-entrance\` | \`300\` | \`0\` | 40%: 0.5 |');
    expect(lines.some(l => l.startsWith('|  | \`transform\`'))).toBe(true);
  });
  it('draws the timeline as text, a bar per element on a ruler', () => {
    const block = lines.slice(lines.indexOf('\`\`\`') + 1, lines.lastIndexOf('\`\`\`'));
    expect(block).toHaveLength(3);
    expect(block[0]).toMatch(/^card +█+ +0–300ms$/);
    expect(block[1]).toMatch(/^title +█+ +70–290ms$/);
    expect(block[2]).toMatch(/ms$/);
  });
  it('escapes a pipe so a cell cannot break the table', () => {
    const odd: MotionVersion = { ...tween, keyframes: [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 1 }], model: { model: 'tween', duration: 'duration.300', easing: 'a|b' } };
    expect(motionTableMarkdown(motionTableOf(odd, raw, 'card')).join('\n')).toContain('a\\|b');
  });
  it('says nothing for a version with nothing to show', () => {
    expect(motionTableMarkdown([])).toEqual([]);
  });
});
