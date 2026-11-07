import { test, expect } from '@playwright/test';

test.describe('Theme switch', () => {
  test('switches the dark theme on the html element, from Settings', async ({ page }) => {
    await page.goto('/?view=component');
    await page.click('#settings-btn');
    await page.click('#theme-dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.click('#theme-light');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'dark');
  });
});
