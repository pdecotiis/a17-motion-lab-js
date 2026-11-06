import { test, expect } from '@playwright/test';
import { setRuntime } from './lab.js';

// The motion table under the preview in the component view (lab/lib/motion-table.ts). It opens on the lab's default
// component, so it runs in a project as well as in the template.
test.describe('Motion table', () => {
  test('documents the open version: a header with the component, a table, and a timeline', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/?view=component');
    const table = page.locator('#motion-table');
    await expect(table.locator('.lab-mt-title')).not.toBeEmpty();
    await expect(table.locator('.lab-mt-version')).toContainText('v1');
    await expect(table.locator('.lab-mt-heading').first()).toBeVisible();
    await expect(table.locator('.lab-mt-table').first().locator('th').first()).toHaveText('Element');
    expect(await table.locator('.lab-mt-table tbody tr').count()).toBeGreaterThan(0);
    expect(await table.locator('.lab-mt-bar').count()).toBeGreaterThan(0);
    await expect(table.locator('.lab-mt-tick').first()).toHaveText('0');
    expect(errors).toEqual([]);
  });

  test('is the version as authored: it does not change with the runtime', async ({ page }) => {
    await page.goto('/?view=component');
    const before = await page.locator('#motion-table').innerText();
    await setRuntime(page, 'motion');
    await expect(page.locator('#motion-table .lab-mt-title')).not.toBeEmpty();
    expect(await page.locator('#motion-table').innerText()).toBe(before);
  });

  test('switching version rewrites it', async ({ page }) => {
    await page.goto('/?view=component');
    const tabs = page.locator('.lab-version-tab');
    test.skip((await tabs.count()) < 2, 'needs a component with two versions');
    const first = await page.locator('#motion-table .lab-mt-version').innerText();
    await tabs.nth(1).click();
    await expect(page.locator('#motion-table .lab-mt-version')).not.toHaveText(first);
  });

  test('token names in the table read the way the Tokens view writes them: hyphens, easing without its group', async ({ page }) => {
    await page.goto('/?view=component');
    const text = await page.locator('#motion-table .lab-mt-table').first().innerText();
    expect(text).not.toMatch(/\beasing\./);
    expect(text).not.toMatch(/\bduration\.\d/);
  });
});
