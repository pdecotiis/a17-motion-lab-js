import { test, expect } from '@playwright/test';
import { compareToBaseline, MAX_DIFF_RATIO } from './visual.js';

test.describe('Page Header Title', () => {
  test('renders the component', async ({ page }) => {
    await page.goto('/?view=component&component=page-header-title');
    await expect(page.locator('[data-motion-target]').first()).toBeVisible();
    await expect(page.getByText('We believe deep learning is the future of quantitative trading.')).toBeVisible();
  });

  test('v1 plays without error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=component&component=page-header-title&version=v1');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('static end state matches the Figma screenshot', async ({ page }) => {
    const result = await compareToBaseline(page, 'page-header-title', 'v1');
    expect(result.ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
  });
});
