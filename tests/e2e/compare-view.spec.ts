import { test, expect } from '@playwright/test';

// The Compare with panel is switched off (SHOW_COMPARE in lab/main.ts) but its logic stays: these tests show it
// first, then check it still works.
const showCompare = (page: import('@playwright/test').Page) => page.evaluate(() => { document.querySelector<HTMLElement>('[aria-label="Compare"]')!.hidden = false; });

test.describe('Compare view', () => {
  test('compare select shows v2 option when on v1', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await showCompare(page);
    const compareSelect = page.locator('#compare-select');
    await expect(compareSelect.locator('option[value="v2"]')).toHaveCount(1);
  });

  test('selecting a compare version shows the compare area', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await showCompare(page);
    await page.locator('#compare-select').selectOption('v2');
    await expect(page.locator('#compare-area')).toBeVisible();
  });

  test('compare area contains card markup in secondary preview', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await showCompare(page);
    await page.locator('#compare-select').selectOption('v2');
    await expect(page.locator('#preview-inner-secondary .card')).toBeVisible();
  });
});
