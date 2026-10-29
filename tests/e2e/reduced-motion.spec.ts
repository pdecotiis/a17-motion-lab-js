import { test, expect } from '@playwright/test';

test.describe('prefers-reduced-motion', () => {
  test('shows reduced motion notice when emulated', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?view=component&component=card');
    await expect(page.locator('#reduced-motion-notice')).toBeVisible();
  });

  test('does not show notice in normal mode', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?view=component&component=card');
    await expect(page.locator('#reduced-motion-notice')).not.toBeVisible();
  });
});
