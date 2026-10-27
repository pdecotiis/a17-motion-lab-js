import { test, expect } from '@playwright/test';

test.describe('Theme toggle', () => {
  test('toggles dark theme on html element', async ({ page }) => {
    await page.goto('/?view=component&component=card');
    const toggle = page.locator('#theme-toggle');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await toggle.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  });
});
