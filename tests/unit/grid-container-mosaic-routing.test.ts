import { describe, it, expect } from 'vitest';
import { resolveTiming, validateMotionVersion } from '../../lab/lib/motion-models.js';
import { compileTokens } from '../../lab/lib/token-compiler.js';
import tokensJson from '../../tokens/motion.json';
import type { DtcgGroup } from '../../lab/lib/types.js';
import { v1, versions } from '../../components/grid-container-mosaic-routing/motion.js';
import { validateVersionMeta } from '../../lab/lib/version-meta.js';
import { validateImportedComponent } from '../../scripts/figma-import/lib.js';

const { raw } = compileTokens(tokensJson as unknown as DtcgGroup);

describe('Grid Container Mosaic Routing motion versions', () => {
  describe('v1 (Default Entrance — tween)', () => {
    it('validates with no structural keyframe properties', () => {
      expect(() => validateMotionVersion(v1)).not.toThrow();
    });

    it('produces a numeric duration', () => {
      const t = resolveTiming(v1, raw);
      expect(typeof t.duration).toBe('number');
      expect(t.duration).toBeGreaterThan(0);
    });

    it('produces a cubic-bezier easing string', () => {
      const t = resolveTiming(v1, raw);
      expect(t.easing).toContain('cubic-bezier');
    });

    it('resolves duration.400 to a concrete duration', () => {
      expect(resolveTiming(v1, raw).duration).toBe(Number.parseFloat(String((raw as Record<string, unknown>)['duration.400'])));
    });
  });

  it('has valid version metadata', () => {
    expect(() => validateVersionMeta(versions)).not.toThrow();
  });

  it('is a valid imported component folder', () => {
    expect(validateImportedComponent(process.cwd(), 'grid-container-mosaic-routing')).toEqual([]);
  });
});

// The morph (v2, v3). v2 changes the grid's tracks (and a margin or two that keep every gutter at 8px) between layouts in which every
// cell is a half or a third of its row or column; v3 plays the older transform morph in as an entrance.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { v2, v3 } from '../../components/grid-container-mosaic-routing/motion.js';
import { partValues } from '../../lab/lib/interaction.js';
import { getTokenRefs, pairingWarnings } from '../../lab/lib/token-refs.js';

const markup = readFileSync(join(process.cwd(), 'components/grid-container-mosaic-routing/markup.html'), 'utf8');
const i = v2.interaction!;
const px = (s: unknown) => String(s).split(' ').map(v => Number.parseFloat(v));

describe('v2 (morph: cells share the space)', () => {
  it('has a click that toggles default and two-thirds, and no entrance', () => {
    expect(i.initial).toBe('default');
    expect(i.triggers).toEqual([{ on: 'click', toggle: ['default', 'two-thirds'] }]);
    expect(v2.model).toBeUndefined();
    expect(v2.forkedFrom).toBe('v1');
  });
  it('changes only the grid, the first photo and the lilac card, and every one exists in the markup', () => {
    expect(Object.keys(i.layers!).sort()).toEqual(['grid', 'image-1', 'tile-2']);
    for (const name of Object.keys(i.layers!)) expect(markup, name).toContain(`data-motion="${name}"`);
  });
  it('starts as the Figma layout: four 238px columns, two 296px rows, 8px gaps', () => {
    const d = partValues(i, 'grid', 'default');
    expect(px(d['gridTemplateColumns'])).toEqual([238, 238, 238, 238]);
    expect(px(d['gridTemplateRows'])).toEqual([296, 296]);
    expect(d['columnGap']).toBe('8px');
  });
  it.each(Object.keys(i.states))('%s fills the grid exactly (976 x 600px) with the gaps it sets', state => {
    const g = partValues(i, 'grid', state);
    const gap = Number.parseFloat(String(g['columnGap']));
    expect(px(g['gridTemplateColumns']).reduce((a, b) => a + b, 0) + 3 * gap, state).toBe(976);
    expect(px(g['gridTemplateRows']).reduce((a, b) => a + b, 0) + 8, state).toBe(600);
  });
  it.each(Object.keys(i.states))('%s keeps every gutter at 8px', state => {
    const g = partValues(i, 'grid', state);
    const [c1, c2, c3, c4] = px(g['gridTemplateColumns']) as [number, number, number, number];
    const gap = Number.parseFloat(String(g['columnGap']));
    const m1 = partValues(i, 'image-1', state), m2 = partValues(i, 'tile-2', state);
    const [l1, r1, l2] = [m1['marginLeft'], m1['marginRight'], m2['marginLeft']].map(v => Number.parseFloat(String(v)));
    const orangeEnd = c1 + gap + c2;
    // row 1: orange | first photo | second photo (the first photo's box is its column less its margins)
    const photoStart = orangeEnd + gap + l1!;
    const photoEnd = orangeEnd + gap + c3 - r1!;
    const secondStart = orangeEnd + gap + c3 + gap;
    if (c3 > 0 && c4 > 0) { expect(photoStart - orangeEnd, `${state} orange to first photo`).toBe(8); expect(secondStart - photoEnd, `${state} first photo to second`).toBe(8); }
    else if (c3 === 0) expect(secondStart - orangeEnd - 2 * gap - l1! - r1! + (gap + l1!) + (gap - r1!), state).toBeGreaterThan(-1); // c3 closed: orange and the second photo meet across the closed column
    // row 2: third photo | lilac card (the lilac card starts at the third column plus its own margin)
    expect(orangeEnd + gap + l2! - orangeEnd, `${state} third photo to lilac`).toBe(8);
  });
  it('closes a column (0) in two-thirds, half-left, half-right, third-left, mix-2 and a row in tall', () => {
    const zero = (s: string, k: string, at: number) => px(partValues(i, 'grid', s)[k])[at];
    expect(zero('two-thirds', 'gridTemplateColumns', 3)).toBe(0);
    expect(zero('half-left', 'gridTemplateColumns', 2)).toBe(0);
    expect(zero('half-right', 'gridTemplateColumns', 3)).toBe(0);
    expect(zero('third-left', 'gridTemplateColumns', 2)).toBe(0);
    expect(zero('mix-2', 'gridTemplateColumns', 3)).toBe(0);
    expect(zero('tall', 'gridTemplateRows', 1)).toBe(0);
  });
  it('divides the space only by halves and thirds: thirds of the row (+- 8px), halves, and the top and bottom rows 1/3 and 2/3', () => {
    const near = (n: number, whole: number) => [1 / 2, 1 / 3, 2 / 3].some(f => Math.abs(n - whole * f) <= 12);
    for (const state of ['two-thirds', 'half-left', 'half-right', 'third-left', 'thirds']) {
      const [c1, c2, c3, c4] = px(partValues(i, 'grid', state)['gridTemplateColumns']) as number[];
      const gap = Number.parseFloat(String(partValues(i, 'grid', state)['columnGap']));
      expect(near(c1! + gap + c2!, 976), `${state} orange`).toBe(true);
      if (c3 && c3 > 0) expect(near(c3 + (state === 'two-thirds' ? 8 : 0), 976), `${state} first photo`).toBe(true);
      if (c4 && c4 > 0) expect(near(c4, 976), `${state} second photo`).toBe(true);
    }
    for (const state of ['top', 'bottom']) {
      const r = px(partValues(i, 'grid', state)['gridTemplateRows']) as number[];
      expect([197, 395]).toEqual([...r].sort((a, b) => a - b));
    }
  });
  it('plays into the states over 800ms and back to default faster, with an exit easing', () => {
    expect(i.transitions['two-thirds']).toMatchObject({ duration: 'duration.800', easing: 'easing.expressive-standard' });
    expect(i.transitions['default']).toMatchObject({ duration: 'duration.400', easing: 'easing.expressive-exit' });
  });
  it('names only tokens that exist and follows the pairing rules', () => {
    expect(getTokenRefs(v2, raw).hardcoded).toEqual([]);
    expect(pairingWarnings(v2, raw)).toEqual([]);
  });
});

describe('v3 (morph in)', () => {
  const layers = Object.keys(v3.layers ?? {});
  it('moves the orange cell, its text, the photos and the lilac card, and every one exists in the markup', () => {
    expect(layers.sort()).toEqual(['actions', 'heading', 'image-1', 'image-2', 'image-3', 'tile-1', 'tile-2']);
    for (const name of layers) expect(markup, name).toContain(`data-motion="${name}"`);
  });
  it('ends every cell in the Figma layout, so its end state is the design', () => {
    for (const name of layers) {
      const step = v3.layers![name] as unknown as { keyframes: { transform: string }[] };
      expect(step.keyframes.at(-1)!.transform, name).toBe('none');
    }
  });
  it('fades the section in and says nothing about when it plays', () => {
    expect(v3.model).toMatchObject({ model: 'tween', duration: 'duration.220' });
    expect(v3.trigger).toBeUndefined();
    expect(v3.forkedFrom).toBe('v1');
  });
  it('validates, names only tokens that exist and follows the pairing rules', () => {
    expect(() => validateMotionVersion(v3)).not.toThrow();
    expect(getTokenRefs(v3, raw).hardcoded).toEqual([]);
    expect(pairingWarnings(v3, raw)).toEqual([]);
  });
});
