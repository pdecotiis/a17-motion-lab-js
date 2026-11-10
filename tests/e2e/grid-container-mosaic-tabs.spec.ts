import { test, expect } from '@playwright/test';

// Tabs above a bento: each tab morphs the cells (the grid's tracks), crossfades the pictures and recolours the card. Both runtimes.
for (const runtime of ['css', 'motion']) {
  test(`grid-container-mosaic-tabs v1 (${runtime}): a tab morphs the bento between its three layouts`, async ({ page }) => {
    await page.goto(`/?view=component&component=grid-container-mosaic-tabs&version=v1&runtime=${runtime}`);
    await page.locator('[data-motion="bento"]').waitFor();
    await page.waitForTimeout(2500);
    const size = (name: string) => page.evaluate(n => { const r = document.querySelector(`[data-motion="${n}"]`)!.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }, name);
    expect(await size('big')).toEqual([712, 536]);
    expect(await size('card')).toEqual([352, 264]);
    await page.locator('[data-motion="tab-trading"]').click();
    await page.waitForTimeout(1500);
    expect(await size('big')).toEqual([352, 536]);
    expect(await size('card')).toEqual([712, 264]);
    await page.locator('[data-motion="tab-technology"]').click();
    await page.waitForTimeout(1500);
    expect(await size('big')).toEqual([532, 536]);
    await expect(page.locator('[data-motion="title-technology"]')).toHaveCSS('opacity', '1');
    await expect(page.locator('[data-motion="title-ml"]')).toHaveCSS('opacity', '0');
  });
}
