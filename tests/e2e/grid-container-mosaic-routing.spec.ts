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
});
