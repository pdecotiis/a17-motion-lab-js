import { test, expect } from '@playwright/test';
import { compareToBaseline, MAX_DIFF_RATIO } from './visual.js';

test.describe('Grid Container Mosaic Routing', () => {
  test('renders the component', async ({ page }) => {
    await page.goto('/?view=component&component=grid-container-mosaic-routing');
    await expect(page.locator('[data-motion-target]').first()).toBeVisible();
    await expect(page.getByText('Machine Learning')).toBeVisible();
  });

  test('v1 plays without error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=component&component=grid-container-mosaic-routing&version=v1');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('static end state matches the Figma screenshot', async ({ page }) => {
    const result = await compareToBaseline(page, 'grid-container-mosaic-routing', 'v1');
    expect(result.ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
  });

  // The morph (v2): a click moves the orange Machine Learning cell from two columns to three and the others make room.
  for (const runtime of ['css', 'motion']) {
    test(`v2 morphs on click under ${runtime}: the orange cell grows to two thirds, the bars stay`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      const q = runtime === 'motion' ? '&runtime=motion' : '';
      await page.goto(`/?view=component&component=grid-container-mosaic-routing&version=v2${q}`);
      const box = async (name: string) => (await page.locator(`[data-motion="${name}"]`).first().boundingBox())!;
      const root = page.locator('[data-motion-target]').first();
      // A version with only click triggers plays its first move when it opens: it goes from the Figma layout to two-thirds.
      const wide = async () => { await expect(root).toHaveAttribute('data-state', 'two-thirds'); await expect.poll(async () => Math.round((await box('tile-1')).width), { timeout: 5000 }).toBe(648); };
      const figma = async () => { await expect(root).toHaveAttribute('data-state', 'default'); await expect.poll(async () => Math.round((await box('tile-1')).width), { timeout: 5000 }).toBe(484); };
      await wide();
      await expect.poll(async () => Math.round((await box('tile-2')).width), { timeout: 5000 }).toBe(320);
      // Where a bar sits in the section (the stage may re-centre, so not on the page).
      const inSection = async (name: string) => { const r = await box('grid-container-mosaic-routing'); const b = await box(name); return { x: Math.round(b.x - r.x), y: Math.round(b.y - r.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      const bars = { one: await inSection('bar-1'), two: await inSection('bar-2') };
      await page.locator('[data-motion="tile-1"]').first().click();
      await figma();
      expect(await inSection('bar-1')).toEqual(bars.one);
      expect(await inSection('bar-2')).toEqual(bars.two);
      await page.locator('[data-motion="tile-1"]').first().click();
      await wide();
      expect(errors).toHaveLength(0);
    });
  }

  test('v3 plays the morph in as an entrance and ends in the Figma layout', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=component&component=grid-container-mosaic-routing&version=v3');
    await expect.poll(async () => Math.round((await page.locator('[data-motion="tile-1"]').first().boundingBox())!.width), { timeout: 5000 }).toBe(484);
    expect(errors).toHaveLength(0);
  });
});
