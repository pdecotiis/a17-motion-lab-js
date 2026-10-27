import { test, expect } from '@playwright/test';

test.describe('Component view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
  });

  test('renders the card component', async ({ page }) => {
    await expect(page.locator('.card')).toBeVisible();
  });

  test('switching version tabs changes version URL param', async ({ page }) => {
    await page.click('[data-version-id="v2"]');
    await expect(page).toHaveURL(/version=v2/);
  });

  test('replay button exists and is clickable', async ({ page }) => {
    const replayBtn = page.locator('#replay-btn');
    await expect(replayBtn).toBeVisible();
    await replayBtn.click();
  });

  test('live duration input is present and accepts input', async ({ page }) => {
    const input = page.locator('#ctrl-duration');
    await expect(input).toBeVisible();
    await input.fill('500');
    await input.dispatchEvent('change');
  });

  test('easing select is present', async ({ page }) => {
    await expect(page.locator('#ctrl-easing')).toBeVisible();
  });

  test('copy values button exists', async ({ page }) => {
    await expect(page.locator('#copy-values-btn')).toBeVisible();
  });

  test('compare select is present', async ({ page }) => {
    await expect(page.locator('#compare-select')).toBeVisible();
  });
});
