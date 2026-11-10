import { test, expect } from '@playwright/test';

// The Figma frame is 1136 x 1452, taller than the largest screenshot the Figma connector returns (1024px), so there is no full-size baseline
// image to compare against: the layout is checked by measuring the cells instead (352 x 227 cards and pictures one or two cells across and tall).
test.describe('Card Routing Bento', () => {
  test('renders the nine cells in the design\'s layout', async ({ page }) => {
    await page.goto('/?view=component&component=card-routing-bento');
    await expect(page.locator('[data-motion-target]').first()).toBeVisible();
    await page.waitForTimeout(1500);
    const size = (name: string) => page.evaluate(n => { const r = document.querySelector(`[data-motion="${n}"]`)!.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }, name);
    expect(await size('cell-1')).toEqual([352, 227]);   // a colour card
    expect(await size('cell-2')).toEqual([712, 463]);   // a picture two across, two tall
    expect(await size('cell-4')).toEqual([712, 463]);
    expect(await size('cell-5')).toEqual([352, 227]);
    expect(await size('grid')).toEqual([1072, 1404]);
    await expect(page.getByText('Trading')).toBeVisible();
  });

  test('v1 plays without error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=component&component=card-routing-bento&version=v1');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});
