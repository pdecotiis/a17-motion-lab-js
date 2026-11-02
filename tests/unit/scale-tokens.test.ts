import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { scaleValues, scaleKind, remapReferences, formatTokenFile, applyScale, readScaleConfig, withScaleConfig, parseArgs } from '../../scripts/scale-tokens.js';
import { deriveKind } from '../../lab/lib/scales.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import type { DtcgGroup } from '../../lab/lib/types.js';

const file = readFileSync(join(process.cwd(), 'tokens/motion.json'), 'utf8');
const tokens = JSON.parse(file) as Record<string, unknown>;

describe('scaleValues', () => {
  it('fibonacci is base × 1, 2, 3, 5, 8, …', () => {
    expect(scaleValues('fibonacci', 100, 6)).toEqual([100, 200, 300, 500, 800, 1300]);
    expect(scaleValues('fibonacci', 4, 5)).toEqual([4, 8, 12, 20, 32]);
  });

  it('a ratio is base × ratio^i, rounded', () => {
    expect(scaleValues(1.4, 100, 5)).toEqual([100, 140, 196, 274, 384]);
    expect(scaleValues(2, 4, 4)).toEqual([4, 8, 16, 32]);
  });

  it('rejects a ratio of 1 or less, and steps that round to the same value', () => {
    expect(() => scaleValues(1, 100, 4)).toThrow('above 1');
    expect(() => scaleValues(0.5, 100, 4)).toThrow('above 1');
    expect(() => scaleValues(1.1, 2, 4)).toThrow('both round to');
  });

  it('rejects a bad base or step count', () => {
    expect(() => scaleValues(1.4, 0, 4)).toThrow('base');
    expect(() => scaleValues(1.4, 100, 0)).toThrow('steps');
  });
});

describe('scaleKind', () => {
  const durations = [100, 140, 220, 300, 400, 560, 800, 1200];

  it('rewrites the kind with value-named tokens, in the right unit and type', () => {
    const { tokens: next } = scaleKind(tokens, 'duration', scaleValues('fibonacci', 100, 4));
    const group = next['duration'] as Record<string, { $type: string; $value: string }>;
    expect(Object.keys(group)).toEqual(['100', '200', '300', '500']);
    expect(group['300']).toMatchObject({ $type: 'duration', $value: '300ms' });
    const { tokens: dist } = scaleKind(tokens, 'distance', scaleValues(2, 4, 3));
    expect((dist['distance'] as Record<string, { $type: string; $value: string }>)['8']).toMatchObject({ $type: 'dimension', $value: '8px' });
  });

  it('leaves every other kind alone', () => {
    const { tokens: next } = scaleKind(tokens, 'duration', scaleValues(1.4, 100, 8));
    for (const kind of Object.keys(tokens).filter(k => k !== 'duration')) expect(next[kind]).toEqual(tokens[kind]);
  });

  it('maps each old step to the new one in the same position', () => {
    const { renames } = scaleKind(tokens, 'duration', scaleValues(1.4, 100, 8));
    expect(renames['duration.100']).toBe('duration.100');
    expect(renames['duration.140']).toBe('duration.140');
    expect(renames['duration.220']).toBe('duration.196');
    expect(renames['duration.1200']).toBe('duration.1054');
  });

  it('a renamed token keeps its status and notes, and records the old name', () => {
    const withNote = structuredClone(tokens) as Record<string, Record<string, { $description?: string }>>;
    withNote['duration']!['220']!.$description = 'Medium';
    const { tokens: next } = scaleKind(withNote, 'duration', scaleValues(1.4, 100, 8));
    const step = (next['duration'] as Record<string, { $description?: string; $extensions: { status: string; oldNames?: string[] } }>)['196']!;
    expect(step.$description).toBe('Medium');
    expect(step.$extensions).toEqual({ status: 'system', oldNames: ['220'] });
  });

  it('a token whose name did not change records no old name', () => {
    const { tokens: next } = scaleKind(tokens, 'duration', scaleValues(1.4, 100, 8));
    expect((next['duration'] as Record<string, { $extensions: { oldNames?: string[] } }>)['100']!.$extensions.oldNames).toBeUndefined();
  });

  it('new steps beyond the old ones start experimental', () => {
    const { tokens: next } = scaleKind(tokens, 'duration', scaleValues(1.4, 100, 10));
    const group = next['duration'] as Record<string, { $extensions: { status: string } }>;
    const names = Object.keys(group);
    expect(group[names[7]!]!.$extensions.status).toBe('system');
    expect(group[names[8]!]!.$extensions.status).toBe('experimental');
    expect(group[names[9]!]!.$extensions.status).toBe('experimental');
  });

  it('fewer steps fold the leftover old steps into the last, which keeps the highest status', () => {
    const mixed = structuredClone(tokens) as Record<string, Record<string, { $extensions: { status: string } }>>;
    for (const n of durations) mixed['duration']![String(n)]!.$extensions.status = 'experimental';
    mixed['duration']!['800']!.$extensions.status = 'system';
    const { tokens: next, renames } = scaleKind(mixed, 'duration', scaleValues(2, 100, 5));
    const group = next['duration'] as Record<string, { $extensions: { status: string; oldNames?: string[] } }>;
    expect(Object.keys(group)).toEqual(['100', '200', '400', '800', '1600']);
    expect(group['1600']!.$extensions.status).toBe('system');
    expect(group['1600']!.$extensions.oldNames).toEqual(['400', '560', '800', '1200']);
    expect(group['200']!.$extensions.status).toBe('experimental');
    expect(renames['duration.1200']).toBe('duration.1600');
    expect(renames['duration.560']).toBe('duration.1600');
  });

  it('the result still compiles', () => {
    const { tokens: next } = scaleKind(tokens, 'distance', scaleValues('fibonacci', 4, 8));
    expect(() => compileTokens(next as unknown as DtcgGroup)).not.toThrow();
  });

  it('throws for a kind with no group', () => {
    expect(() => scaleKind({}, 'delay', [40, 70])).toThrow('no "delay" group');
  });
});

describe('remapReferences', () => {
  const renames = { 'duration.300': 'duration.360', 'duration.360': 'duration.400', 'distance.16': 'distance.20' };

  it('renames whole references in a version file', () => {
    expect(remapReferences("duration: 'duration.300', stagger: 'delay.70'", renames)).toBe("duration: 'duration.360', stagger: 'delay.70'");
    expect(remapReferences("transform: 'translateY(-{distance.16})'", renames)).toBe("transform: 'translateY(-{distance.20})'");
  });

  it('renames in a single pass, so a new name is never renamed again', () => {
    expect(remapReferences("'duration.300' 'duration.360'", renames)).toBe("'duration.360' 'duration.400'");
  });

  it('leaves longer names and names inside other words alone', () => {
    expect(remapReferences("'duration.3000' 'my-duration.300' 'duration.300x'", renames)).toBe("'duration.3000' 'my-duration.300' 'duration.300x'");
  });

  it('does nothing without renames', () => {
    expect(remapReferences('anything', {})).toBe('anything');
  });
});

describe('formatTokenFile', () => {
  it('reproduces tokens/motion.json exactly, so a regenerated file diffs cleanly', () => {
    expect(formatTokenFile(tokens)).toBe(file);
  });

  it('puts one token on each line', () => {
    expect(formatTokenFile({ duration: { '100': { $type: 'duration', $value: '100ms', $extensions: { status: 'system' } } } }))
      .toBe('{\n  "duration": {\n    "100": { "$type": "duration", "$value": "100ms", "$extensions": { "status": "system" } }\n  }\n}\n');
  });
});

describe('scaleKind with derived tokens (opacity and scale)', () => {
  it('opacity: tokens named by percent, as numbers, taking over the old steps', () => {
    const { tokens: out, renames } = scaleKind(tokens, 'opacity', deriveKind('opacity', 'major-third'));
    const group = out['opacity'] as Record<string, { $type: string; $value: number; $extensions: { status: string; oldNames?: string[] } }>;
    // (JS lists whole-number-like keys first; the file writer sorts them)
    expect(Object.keys(group).sort((a, b) => Number(a) - Number(b))).toEqual(['04', '05', '06', '08', '10', '12', '15', '19']);
    expect(group['05']).toMatchObject({ $type: 'number', $value: 0.05 });
    // opacity.56 was the old fourth step: it becomes the new fourth, and remembers its name
    expect(renames['opacity.56']).toBe('opacity.08');
    expect(group['08']!.$extensions.oldNames).toContain('56');
    expect(group['08']!.$extensions.status).toBe('system');
    expect(group['19']!.$extensions.status).toBe('experimental');
  });

  it('scale: tokens named by percent around 100%, smallest first', () => {
    const { tokens: out } = scaleKind(tokens, 'scale', deriveKind('scale', 'perfect-fourth'));
    const names = Object.keys(out['scale'] as object).map(Number);
    expect(names).toEqual([...names].sort((a, b) => a - b));
    expect(names).toHaveLength(10);
    expect(names.filter(n => n > 100)).toHaveLength(2);
    const { raw } = compileTokens(out as unknown as DtcgGroup);
    for (const n of names) expect(raw[`scale.${n}`], String(n)).toBeCloseTo(n / 100, 5);
  });
});

describe('applyScale: one scale for every kind', () => {
  const kinds = ['distance', 'duration', 'delay', 'opacity', 'scale'] as const;

  it('regenerates all five kinds, and the result still compiles', () => {
    const run = applyScale(tokens, [...kinds], 'major-third');
    expect(Object.keys(run.derived)).toEqual([...kinds]);
    const { raw } = compileTokens(run.tokens as unknown as DtcgGroup);
    expect(raw['distance.4']).toBe('4px');
    expect(raw['distance.19']).toBe('19px');
    expect(raw['duration.477']).toBe('477ms');
    expect(raw['delay.63']).toBe('63ms');
    expect(raw['opacity.19']).toBe(0.19);
  });

  it('leaves easing and bounce alone', () => {
    const run = applyScale(tokens, [...kinds], 'golden-ratio');
    expect(run.tokens['easing']).toEqual(tokens['easing']);
    expect(run.tokens['bounce']).toEqual(tokens['bounce']);
  });

  it('records the scale of each kind in motion.json, and the tokens read back as it', () => {
    expect(readScaleConfig(tokens)).toEqual({});
    const run = applyScale(tokens, [...kinds], 'golden-ratio', { distance: { base: 8, steps: 4, snap: 4 } });
    const config = readScaleConfig(run.tokens);
    expect(Object.keys(config)).toEqual([...kinds]);
    expect(config.distance).toEqual({ scale: 'golden-ratio', base: 8, steps: 4, snap: 4 });
    expect(Object.keys(run.tokens['distance'] as object).sort((a, b) => Number(a) - Number(b))).toEqual(['8', '12', '20', '36']);
    expect(config.opacity).toEqual({ scale: 'golden-ratio' });
  });

  it('a later run for one kind keeps the others recorded', () => {
    const all = applyScale(tokens, [...kinds], 'major-third').tokens;
    const one = applyScale(all, ['delay'], 'fibonacci').tokens;
    const config = readScaleConfig(one);
    expect(config.delay).toEqual({ scale: 'fibonacci' });
    expect(config.distance).toEqual({ scale: 'major-third' });
  });

  it('applying the same scale again changes no names', () => {
    const once = applyScale(tokens, [...kinds], 'minor-third');
    const twice = applyScale(once.tokens, [...kinds], 'minor-third');
    for (const [from, to] of Object.entries(twice.renames)) expect(from).toBe(to);
    expect(twice.tokens).toEqual(once.tokens);
  });

  it('a scale that does not fit one kind changes nothing: the error comes before any write', () => {
    expect(() => applyScale(tokens, ['delay', 'distance'], 'minor-third', { distance: { base: 1 } })).toThrow('use a larger base or ratio');
    expect(() => applyScale(tokens, ['delay'], 'lydian')).toThrow('Unknown scale');
  });

  it('a custom ratio works for any kind', () => {
    const run = applyScale(tokens, ['distance'], '1.5');
    expect(Object.keys(run.tokens['distance'] as object).sort((a, b) => Number(a) - Number(b))).toEqual(['4', '6', '9', '14', '20', '30', '46', '68']);
    expect(readScaleConfig(run.tokens).distance).toEqual({ scale: '1.5' });
  });

  it('renames are collected for every kind, so references follow them', () => {
    const run = applyScale(tokens, [...kinds], 'perfect-fourth');
    expect(run.renames['distance.16']).toBeDefined();
    expect(run.renames['duration.300']).toBeDefined();
    expect(Object.keys(run.renames).every(k => /^(distance|duration|delay|opacity|scale)\./.test(k))).toBe(true);
  });

  it('the recorded scale survives formatting: the file is written and read back the same', () => {
    const run = applyScale(tokens, [...kinds], 'major-third');
    const written = formatTokenFile(run.tokens);
    expect(JSON.parse(written)).toEqual(JSON.parse(JSON.stringify(run.tokens)));
    expect(written).toContain('"$extensions"');
    expect(readScaleConfig(JSON.parse(written) as Record<string, unknown>).distance?.scale).toBe('major-third');
    expect(formatTokenFile(withScaleConfig(tokens, {}))).toContain('"scale": {');
  });
});

describe('parseArgs', () => {
  it('reads positional arguments, value flags and the boolean flags', () => {
    const { positional, flags } = parseArgs(['--', '--all', 'major-third', '--snap', '4', '--dry-run']);
    expect(positional).toEqual(['major-third']);
    expect(flags.get('all')).toBe(true);
    expect(flags.get('dry-run')).toBe(true);
    expect(flags.get('snap')).toBe('4');
  });

  it('a value flag with no value says so', () => {
    expect(() => parseArgs(['distance', 'major-third', '--base'])).toThrow('--base needs a value');
  });
});

// The command as run for real, on a throwaway copy of the tokens and a version file that uses them.
describe('npm run tokens:scale', () => {
  const root = resolve(__dirname, '../..');
  const dir = mkdtempSync(join(tmpdir(), 'motion-lab-scale-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const version = [
    "export const v1 = {",
    "  model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance', delay: 'delay.70' },",
    "  keyframes: [{ transform: 'translateY({distance.16}) scale({scale.95})', opacity: '{opacity.56}' }],",
    "};",
    "",
  ].join('\n');

  const setup = (): string => {
    const d = mkdtempSync(join(dir, 'run-'));
    mkdirSync(join(d, 'tokens'));
    cpSync(join(root, 'tokens/motion.json'), join(d, 'tokens/motion.json'));
    mkdirSync(join(d, 'components/card/versions'), { recursive: true });
    writeFileSync(join(d, 'components/card/versions/v1.ts'), version);
    return d;
  };
  const run = (...args: string[]) =>
    spawnSync('npx', ['vite-node', 'scripts/scale-tokens.ts', '--', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, VITEST: '' } });

  it('--all applies one scale to every kind, follows the references and records the scale', () => {
    const d = setup();
    const r = run('--all', 'major-third', '--root', d);
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(readFileSync(join(d, 'tokens/motion.json'), 'utf8')) as Record<string, unknown>;
    expect(readScaleConfig(out).distance).toEqual({ scale: 'major-third' });
    expect(Object.keys(out['distance'] as object).sort((a, b) => Number(a) - Number(b))).toEqual(['4', '5', '6', '8', '10', '12', '15', '19']);
    const { raw } = compileTokens(out as unknown as DtcgGroup);
    // every reference in the version file still names a token that exists
    const refs = [...readFileSync(join(d, 'components/card/versions/v1.ts'), 'utf8').matchAll(/(?:'|\{)((?:distance|duration|delay|opacity|scale)\.\w+)/g)].map(m => m[1]!);
    expect(refs.length).toBeGreaterThan(3);
    for (const ref of refs) expect(raw[ref], ref).toBeDefined();
    expect(r.stdout).toContain('distance.16 → distance.');
  });

  it('--dry-run says what would change and writes nothing', () => {
    const d = setup();
    const before = readFileSync(join(d, 'tokens/motion.json'), 'utf8');
    const r = run('--all', 'perfect-fourth', '--dry-run', '--root', d);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('Dry run');
    expect(r.stdout).toContain('Nothing was written');
    expect(readFileSync(join(d, 'tokens/motion.json'), 'utf8')).toBe(before);
    expect(readFileSync(join(d, 'components/card/versions/v1.ts'), 'utf8')).toBe(version);
  });

  it('one kind with its own base and steps', () => {
    const d = setup();
    const r = run('distance', 'minor-third', '--base', '8', '--steps', '4', '--root', d);
    expect(r.status, r.stderr).toBe(0);
    const out = JSON.parse(readFileSync(join(d, 'tokens/motion.json'), 'utf8')) as Record<string, unknown>;
    expect(Object.keys(out['distance'] as object).sort((a, b) => Number(a) - Number(b))).toEqual(['8', '10', '12', '14']);
    expect(readScaleConfig(out).distance).toEqual({ scale: 'minor-third', base: 8, steps: 4 });
    expect(readScaleConfig(out).delay).toBeUndefined();
  });

  it('says what is wrong and changes nothing for an unknown scale, a bad kind or a collision', () => {
    const d = setup();
    const before = readFileSync(join(d, 'tokens/motion.json'), 'utf8');
    expect(run('distance', 'lydian', '--root', d).stderr).toContain('Unknown scale');
    expect(run('wobble', 'major-third', '--root', d).stderr).toContain('Usage');
    const collide = run('distance', 'minor-third', '--base', '1', '--root', d);
    expect(collide.status).toBe(1);
    expect(collide.stderr).toContain('use a larger base or ratio');
    expect(readFileSync(join(d, 'tokens/motion.json'), 'utf8')).toBe(before);
    expect(existsSync(join(d, 'components/card/versions/v1.ts'))).toBe(true);
  });
});
