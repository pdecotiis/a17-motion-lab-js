import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { compareToBaseline, MAX_DIFF_RATIO } from './visual.js';

// Exercises the visual-check helper against the generic `card` component. The baseline is
// captured from the frame view itself, so no Figma screenshot has to be committed.

const SIZE = { width: 480, height: 320 };

async function captureBaseline(page: import('@playwright/test').Page): Promise<string> {
  await page.setViewportSize(SIZE);
  await page.goto('/?view=frame&component=card&version=v1');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().map(a => a.finished));
  });
  const dir = mkdtempSync(join(tmpdir(), 'ml-baseline-'));
  writeFileSync(join(dir, 'card.png'), await page.screenshot({ clip: { x: 0, y: 0, ...SIZE }, scale: 'css' }));
  return dir;
}

test.describe('Visual check helper', () => {
  test('frame view renders the component without lab chrome', async ({ page }) => {
    await page.goto('/?view=frame&component=card');
    await expect(page.locator('[data-motion-target]').first()).toBeVisible();
    await expect(page.locator('.lab-header')).toBeHidden();
  });

  test('static end state matches a baseline of itself', async ({ page }) => {
    const dir = await captureBaseline(page);
    const result = await compareToBaseline(page, 'card', 'v1', dir);
    expect(result.totalPixels).toBe(SIZE.width * SIZE.height);
    expect(result.ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
  });

  test('a different baseline exceeds the diff threshold', async ({ page }) => {
    const dir = mkdtempSync(join(tmpdir(), 'ml-baseline-'));
    const blank = new PNG({ width: SIZE.width, height: SIZE.height });
    blank.data.fill(0); // fully transparent black never matches the rendered page
    writeFileSync(join(dir, 'card.png'), PNG.sync.write(blank));
    const result = await compareToBaseline(page, 'card', 'v1', dir);
    expect(result.ratio).toBeGreaterThan(MAX_DIFF_RATIO);
  });
});
