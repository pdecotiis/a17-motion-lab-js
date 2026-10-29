import { test, expect } from '@playwright/test';

test.describe('Page view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=page&page=home');
  });

  test('renders 3 card instances', async ({ page }) => {
    await expect(page.locator('.card')).toHaveCount(3);
  });

  test('motion map panel shows dropdowns for each component', async ({ page }) => {
    await expect(page.locator('#motion-map-panel select')).toHaveCount(3);
  });

  test('replay all button exists', async ({ page }) => {
    await expect(page.locator('#replay-all-btn')).toBeVisible();
  });

  test('stagger input exists', async ({ page }) => {
    await expect(page.locator('#stagger-input')).toBeVisible();
  });

  test('URL encodes motion map; reload restores state', async ({ page }) => {
    const selects = page.locator('#motion-map-panel select');
    await selects.nth(1).selectOption('v2');
    await page.waitForFunction(() => window.location.search.includes('mm='));
    const url = page.url();
    await page.goto(url);
    await expect(page.locator('#motion-map-panel select').nth(1)).toHaveValue('v2');
  });
});
