/**
 * Visual check for imported components: renders /?view=frame at the baseline's size,
 * waits for every animation to finish (static end state), and pixel-diffs against
 * tests/baselines/<component>.png (the Figma screenshot).
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export const MAX_DIFF_RATIO = 0.05;

export interface VisualResult {
  ratio: number;
  diffPixels: number;
  totalPixels: number;
  diffPath: string;
}

export async function compareToBaseline(
  page: Page,
  component: string,
  version = 'v1',
  baselineDir = 'tests/baselines',
): Promise<VisualResult> {
  const baseline = PNG.sync.read(readFileSync(join(baselineDir, `${component}.png`)));
  const { width, height } = baseline;

  await page.setViewportSize({ width, height });
  await page.goto(`/?view=frame&component=${component}&version=${version}`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => img.decode().catch(() => undefined)));
    await Promise.all(document.getAnimations().map(a => a.finished));
  });

  const actual = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width, height }, scale: 'css' }));
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(baseline.data, actual.data, diff.data, width, height, { threshold: 0.1 });

  const outDir = 'tests/visual-output';
  mkdirSync(outDir, { recursive: true });
  const diffPath = join(outDir, `${component}-${version}-diff.png`);
  writeFileSync(diffPath, PNG.sync.write(diff));
  writeFileSync(join(outDir, `${component}-${version}-actual.png`), PNG.sync.write(actual));

  return { ratio: diffPixels / (width * height), diffPixels, totalPixels: width * height, diffPath };
}
