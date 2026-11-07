import { test, expect } from '@playwright/test';
import { compareToBaseline, MAX_DIFF_RATIO } from './visual.js';

test.describe('Header', () => {
  test('renders the component', async ({ page }) => {
    await page.goto('/?view=component&component=header');
    await expect(page.locator('[data-motion-target]').first()).toBeVisible();
    await expect(page.getByText('Join Jane Street').first()).toBeVisible();
  });

  test('v1 plays without error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=component&component=header&version=v1');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('static end state matches the Figma screenshot', async ({ page }) => {
    const result = await compareToBaseline(page, 'header', 'v1');
    expect(result.ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
  });
});
