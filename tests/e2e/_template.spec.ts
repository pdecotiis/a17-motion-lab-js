/**
 * Copy to tests/e2e/<component-name>.spec.ts and fill in.
 * Every new component and version requires these test cases.
 */
import { test, expect } from '@playwright/test';

test.describe('<ComponentName>', () => {
  // Fill in when implementing a new component:

  test('renders the component', async ({ page }) => {
    await page.goto('/?view=component&component=<name>');
    // await expect(page.locator('.<name>')).toBeVisible();
    expect(true).toBe(true); // replace with real assertion
  });

  test('v1 plays without error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=component&component=<name>&version=v1');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('v2 plays without error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=component&component=<name>&version=v2');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});
