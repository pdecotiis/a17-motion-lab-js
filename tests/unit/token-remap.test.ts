import { describe, it, expect, afterAll } from 'vitest';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyRemap, type RemapSpec } from '../../lab/lib/token-remap.js';
import { scaleKind, readScaleConfig, type Json } from '../../lab/lib/scale-apply.js';
import { runRemap, runRenames } from '../../scripts/tokens-remap.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import type { DtcgGroup } from '../../lab/lib/types.js';
import tokensJson from '../../tokens/motion.json';
import migration from '../../tokens/migrations/vitrine-base.json';
import { SAMPLES_PRESENT } from '../samples.js';

// Replacing the base tokens of a kind with a set of one's own choosing (lab/lib/token-remap.ts, scripts/tokens-remap.ts):
// each old token goes to the new token with the closest value. These run on a fixed token file (the template's set
// before the Vitrine tokens), so they hold in any project.

const oldTokens = JSON.parse(readFileSync(join(__dirname, 'fixtures/old-motion.json'), 'utf8')) as Json;
const group = (tokens: Json, kind: string): Record<string, { $value: string | number; $extensions?: { status?: string; oldNames?: string[] } }> =>
  tokens[kind] as never;

describe('scaleKind with nearest matching', () => {
  it('sends each old token to the new token with the closest value', () => {
    const { renames } = scaleKind(oldTokens, 'duration', [50, 100, 150, 200, 250, 400, 700, 1200], { match: 'nearest' });
    expect(renames).toMatchObject({
      'duration.100': 'duration.100', 'duration.140': 'duration.150', 'duration.220': 'duration.200',
      'duration.300': 'duration.250', 'duration.400': 'duration.400', 'duration.560': 'duration.700',
      'duration.800': 'duration.700', 'duration.1200': 'duration.1200',
    });
  });

  it('sends a tie to the larger value', () => {
    // 16 is as far from 12 as from 20.
    const { renames } = scaleKind(oldTokens, 'distance', [4, 8, 12, 20, 32], { match: 'nearest' });
    expect(renames['distance.16']).toBe('distance.20');
  });

  it('keeps matching by rank for a scale (the default)', () => {
    const { renames } = scaleKind(oldTokens, 'duration', [50, 100, 150, 200, 250, 400, 700, 1200]);
    expect(renames['duration.300']).toBe('duration.200');
  });

  it('an override says where nearest is not wanted', () => {
    const tokens = [{ name: '90', $type: 'number' as const, $value: 0.9 }, { name: '95', $type: 'number' as const, $value: 0.95 }, { name: '100', $type: 'number' as const, $value: 1 }];
    const plain = scaleKind(oldTokens, 'scale', tokens, { match: 'nearest' });
    expect(plain.renames['scale.98']).toBe('scale.100');
    const forced = scaleKind(oldTokens, 'scale', tokens, { match: 'nearest', overrides: { '98': '95' } });
    expect(forced.renames['scale.98']).toBe('scale.95');
  });

  it('an override to a token that is not in the new set throws, and changes nothing', () => {
    expect(() => scaleKind(oldTokens, 'duration', [100, 200], { match: 'nearest', overrides: { '300': '999' } })).toThrow('duration.999');
  });

  it('a folded token keeps the highest status and records every old name', () => {
    const tokens: Json = {
      ...oldTokens,
      duration: {
        '100': { $type: 'duration', $value: '100ms', $extensions: { status: 'experimental' } },
        '120': { $type: 'duration', $value: '120ms', $extensions: { status: 'system', oldNames: ['quick'] } },
        '500': { $type: 'duration', $value: '500ms', $extensions: { status: 'system' } },
      },
    };
    const out = scaleKind(tokens, 'duration', [110, 500], { match: 'nearest' }).tokens;
    const first = group(out, 'duration')['110']!;
    expect(first.$extensions?.status).toBe('system');
    expect(first.$extensions?.oldNames).toEqual(expect.arrayContaining(['100', '120', 'quick']));
    expect(group(out, 'duration')['500']!.$extensions?.oldNames).toBeUndefined();
  });

  it('a new token with nothing mapped to it starts experimental', () => {
    const out = scaleKind(oldTokens, 'duration', [50, 100, 150, 200, 250, 400, 700, 1200], { match: 'nearest' }).tokens;
    expect(group(out, 'duration')['50']!.$extensions?.status).toBe('experimental');
    expect(group(out, 'duration')['150']!.$extensions?.oldNames).toEqual(['140']);
  });
});

describe('applyRemap', () => {
  const spec: RemapSpec = {
    duration: { values: [100, 200, 400] },
    distance: { scale: 'fibonacci' },
    opacity: { tokens: [{ name: '0', value: 0 }, { name: '100', value: 1 }] },
  };

  it('replaces each kind in the spec and leaves the others alone', () => {
    const { tokens, names } = applyRemap(oldTokens, spec);
    expect(names.duration).toEqual(['100', '200', '400']);
    expect(names.opacity).toEqual(['0', '100']);
    expect(Object.keys(group(tokens, 'distance'))).toEqual(['4', '8', '12', '20', '32', '52', '84', '136']);
    expect(tokens['easing']).toEqual(oldTokens['easing']);
    expect(Object.keys(group(tokens, 'delay'))).toEqual(Object.keys(group(oldTokens, 'delay')));
  });

  it('collects a rename for every old token of every kind in the spec', () => {
    const { renames } = applyRemap(oldTokens, spec);
    expect(renames['duration.140']).toBe('duration.100');
    expect(renames['duration.560']).toBe('duration.400');
    expect(renames['opacity.56']).toBe('opacity.100');
    expect(renames['distance.48']).toBe('distance.52');
    expect(Object.keys(renames).some(k => k.startsWith('delay.'))).toBe(false);
  });

  it('records a scale-generated kind in $extensions.scale.kinds, and not a kind set by hand', () => {
    const { tokens } = applyRemap(oldTokens, spec);
    expect(readScaleConfig(tokens)).toEqual({ distance: { scale: 'fibonacci' } });
  });

  it('forgets the scale a kind had when it is set by hand', () => {
    const withScale: Json = { ...oldTokens, $extensions: { scale: { kinds: { duration: { scale: 'major-third' }, delay: { scale: 'fibonacci' } } } } };
    const { tokens } = applyRemap(withScale, { duration: { values: [100, 200] } });
    expect(readScaleConfig(tokens)).toEqual({ delay: { scale: 'fibonacci' } });
  });

  it('wants exactly one of scale, values or tokens for a kind', () => {
    expect(() => applyRemap(oldTokens, { duration: {} })).toThrow('exactly one');
    expect(() => applyRemap(oldTokens, { duration: { values: [100], scale: 'fibonacci' } })).toThrow('exactly one');
  });

  it('writes a number token\'s value as a number and a duration as ms', () => {
    const { tokens } = applyRemap(oldTokens, spec);
    expect(group(tokens, 'opacity')['100']!.$value).toBe(1);
    expect(group(tokens, 'duration')['200']!.$value).toBe('200ms');
  });
});

// scripts/tokens-remap.ts on a throwaway project.
describe('runRemap and runRenames', () => {
  const dir = mkdtempSync(join(tmpdir(), 'motion-lab-remap-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const version = [
    'export const v1 = {',
    "  model: { model: 'tween', duration: 'duration.300', easing: 'easing.productive-entrance', delay: 'delay.70' },",
    "  keyframes: [{ transform: 'translateY({distance.16}) scale({scale.98})' }],",
    '};',
    '',
  ].join('\n');
  const presets = JSON.stringify({ presets: { title: { rise: 'distance.16', move: { duration: 'duration.560', easing: 'easing.expressive-entrance' } } } }, null, 2);
  const spec: RemapSpec = {
    duration: { values: [100, 250, 700] },
    distance: { scale: 'fibonacci' },
    delay: { scale: 'fibonacci' },
    scale: { tokens: [{ name: '90', value: 0.9 }, { name: '95', value: 0.95 }, { name: '100', value: 1 }], overrides: { '98': '95' } },
  };

  const setup = (tokensFile = join(__dirname, 'fixtures/old-motion.json')): string => {
    const d = mkdtempSync(join(dir, 'project-'));
    mkdirSync(join(d, 'tokens'));
    cpSync(tokensFile, join(d, 'tokens/motion.json'));
    writeFileSync(join(d, 'tokens/presets.json'), presets);
    mkdirSync(join(d, 'components/card/versions'), { recursive: true });
    writeFileSync(join(d, 'components/card/versions/v1.ts'), version);
    return d;
  };
  const read = (d: string, file: string): string => readFileSync(join(d, file), 'utf8');

  it('rewrites the tokens, the version files and the presets table', () => {
    const d = setup();
    const run = runRemap(d, spec);
    expect(run.files.sort()).toEqual(['components/card/versions/v1.ts', 'tokens/presets.json']);
    const v = read(d, 'components/card/versions/v1.ts');
    expect(v).toContain("duration: 'duration.250'");
    expect(v).toContain("delay: 'delay.80'");
    expect(v).toContain('translateY({distance.20}) scale({scale.95})');
    expect(read(d, 'tokens/presets.json')).toContain('"rise": "distance.20"');
    expect(read(d, 'tokens/presets.json')).toContain('"duration": "duration.700"');
    const tokens = JSON.parse(read(d, 'tokens/motion.json')) as Json;
    expect(Object.keys(group(tokens, 'duration'))).toEqual(['100', '250', '700']);
    expect(readScaleConfig(tokens)).toEqual({ distance: { scale: 'fibonacci' }, delay: { scale: 'fibonacci' } });
  });

  it('every reference in the rewritten files is a token that exists', () => {
    const d = setup();
    runRemap(d, spec);
    const { raw } = compileTokens(JSON.parse(read(d, 'tokens/motion.json')) as DtcgGroup);
    const text = read(d, 'components/card/versions/v1.ts') + read(d, 'tokens/presets.json');
    const refs = [...text.matchAll(/\b((?:duration|distance|delay|scale|opacity)\.\d+)\b/g)].map(m => m[1]!);
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(raw, r).toHaveProperty([r]);
  });

  it('a dry run reports the same and writes nothing', () => {
    const d = setup();
    const before = [read(d, 'tokens/motion.json'), read(d, 'tokens/presets.json'), read(d, 'components/card/versions/v1.ts')];
    const run = runRemap(d, spec, true);
    expect(run.dryRun).toBe(true);
    expect(run.files.length).toBe(2);
    expect(run.renames['duration.300']).toBe('duration.250');
    expect([read(d, 'tokens/motion.json'), read(d, 'tokens/presets.json'), read(d, 'components/card/versions/v1.ts')]).toEqual(before);
  });

  it('runRenames rewrites only the references, never the token file', () => {
    const d = setup();
    const tokensBefore = read(d, 'tokens/motion.json');
    const run = runRenames(d, { 'duration.300': 'duration.250', 'distance.16': 'distance.20' });
    expect(run.files.sort()).toEqual(['components/card/versions/v1.ts', 'tokens/presets.json']);
    expect(read(d, 'components/card/versions/v1.ts')).toContain("duration: 'duration.250'");
    expect(read(d, 'components/card/versions/v1.ts')).toContain("delay: 'delay.70'");
    expect(read(d, 'tokens/motion.json')).toBe(tokensBefore);
  });

  it('runRenames in a project that already has the new tokens, with the renames the spec wrote, leaves nothing dangling', () => {
    const template = setup();
    const { renames } = runRemap(template, spec);
    const project = setup();
    cpSync(join(template, 'tokens/motion.json'), join(project, 'tokens/motion.json'));
    runRenames(project, Object.fromEntries(Object.entries(renames).filter(([f, t]) => f !== t)));
    expect(read(project, 'components/card/versions/v1.ts')).toBe(read(template, 'components/card/versions/v1.ts'));
    expect(read(project, 'tokens/presets.json')).toBe(read(template, 'tokens/presets.json'));
  });

  it('renaming twice changes nothing more (a name that was already renamed is not renamed again)', () => {
    const d = setup();
    const { renames } = runRemap(d, spec);
    const once = read(d, 'components/card/versions/v1.ts');
    runRenames(d, Object.fromEntries(Object.entries(renames).filter(([f, t]) => f !== t)));
    expect(read(d, 'components/card/versions/v1.ts')).toBe(once);
  });

  it('also rewrites the page versions, which name component versions and may name a token in a stagger', () => {
    const d = setup();
    mkdirSync(join(d, 'pages/home/versions'), { recursive: true });
    writeFileSync(join(d, 'pages/home/versions/v1.json'), JSON.stringify({ id: 'v1', label: 'One', motionMap: { card: 'v1' }, stagger: 'delay.70' }));
    const run = runRemap(d, spec);
    expect(run.files).toContain('pages/home/versions/v1.json');
    expect(read(d, 'pages/home/versions/v1.json')).toContain('"stagger":"delay.80"');
  });

  it('does not create files that are not there', () => {
    const d = setup();
    rmSync(join(d, 'tokens/presets.json'));
    runRemap(d, spec);
    expect(existsSync(join(d, 'tokens/presets.json'))).toBe(false);
  });
});

// The migration the template shipped (tokens/migrations/vitrine-base.json) and the token file it produced.
// The template's own migration, checked against the template's own token file.
describe.skipIf(!SAMPLES_PRESENT)('tokens/migrations/vitrine-base.json', () => {
  const names = (kind: string): string[] => Object.keys((tokensJson as unknown as Json)[kind] as object);
  const sorted = (kind: string): string[] => names(kind).sort((a, b) => Number(a) - Number(b));
  const spec = migration as unknown as RemapSpec;

  it('describes the Vitrine durations plus the old 1200, opacity of 0 and 1, and scale of 90, 95 and 100', () => {
    expect(spec.duration?.values).toEqual([50, 100, 150, 200, 250, 400, 700, 1200]);
    expect(spec.opacity?.tokens?.map(t => t.name)).toEqual(['0', '100']);
    expect(spec.scale?.tokens?.map(t => t.name)).toEqual(['90', '95', '100']);
  });

  it('the template\'s token file has exactly those', () => {
    expect(sorted('duration')).toEqual(['50', '100', '150', '200', '250', '400', '700', '1200']);
    expect(sorted('opacity')).toEqual(['0', '100']);
    expect(sorted('scale')).toEqual(['90', '95', '100']);
  });

  it('distance and delay follow Fibonacci, and the file records it', () => {
    expect(spec.distance?.scale).toBe('fibonacci');
    expect(spec.delay?.scale).toBe('fibonacci');
    expect(sorted('distance')).toEqual(['4', '8', '12', '20', '32', '52', '84', '136']);
    expect(sorted('delay')).toEqual(['40', '80', '120']);
    expect(readScaleConfig(tokensJson as unknown as Json)).toEqual({ distance: { scale: 'fibonacci' }, delay: { scale: 'fibonacci' } });
  });

  it('applied to the previous token set, it reproduces the template\'s token file (duration.50 was then marked system by hand, as the kit\'s own)', () => {
    const made = applyRemap(oldTokens, spec).tokens;
    (made['duration'] as Record<string, { $extensions: { status: string } }>)['50']!.$extensions.status = 'system';
    expect(made).toEqual(tokensJson);
  });

  it('keeps the old names of every folded token, so a Figma sync can rename in place', () => {
    const duration = tokensJson.duration as Record<string, { $extensions?: { oldNames?: string[] } }>;
    expect(duration['700']!.$extensions?.oldNames).toEqual(['560', '800']);
    expect(duration['250']!.$extensions?.oldNames).toEqual(['300']);
  });

  it('its renames file lists every old name that moved', () => {
    const renames = JSON.parse(readFileSync(join(__dirname, '../../tokens/migrations/vitrine-base.renames.json'), 'utf8')) as Record<string, string>;
    expect(renames['duration.300']).toBe('duration.250');
    expect(renames['scale.98']).toBe('scale.95');
    expect(renames['delay.70']).toBe('delay.80');
    expect(Object.entries(renames).every(([from, to]) => from !== to)).toBe(true);
  });
});
