import { test, expect } from '@playwright/test';

// Uses the dev server configured in playwright.config.ts.
// For built-output testing, run: npm run build && npx serve dist -p 4174
// then update baseURL in playwright.config.ts or use a second project config.

test.describe('App loads without errors', () => {
  test('no console errors on component view', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/?view=component&component=card');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('no console errors on page view', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/?view=page&page=home');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});
