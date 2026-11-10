import { test, expect } from '@playwright/test';

// v13: tabs above a bento. Each tab morphs the cells (the grid's tracks), crossfades the pictures and recolours the card, under both runtimes;
// and the block it uses stays closed in an earlier version.
for (const runtime of ['css', 'motion']) {
  test(`mosaic routing v13 (${runtime}): a tab morphs the bento between its three layouts`, async ({ page }) => {
    await page.goto(`/?view=component&component=grid-container-mosaic-routing&version=v13&runtime=${runtime}`);
    await page.locator('[data-motion="t-bento"]').waitFor();
    await page.waitForTimeout(3000);
    const size = (name: string) => page.evaluate(n => { const r = document.querySelector(`[data-motion="${n}"]`)!.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }, name);
    expect(await size('t-big')).toEqual([712, 536]);
    expect(await size('t-card')).toEqual([352, 264]);
    expect(await size('grid')).toEqual([0, 0]); // the three bentos are closed
    await page.locator('[data-motion="t-tab-trading"]').click();
    await page.waitForTimeout(1500);
    expect(await size('t-big')).toEqual([352, 536]);
    expect(await size('t-card')).toEqual([712, 264]);
    await page.locator('[data-motion="t-tab-technology"]').click();
    await page.waitForTimeout(1500);
    expect(await size('t-big')).toEqual([532, 536]);
    expect(await size('t-card')).toEqual([532, 536]); // the green card fills the height: two cards
    expect((await size('t-small'))[1]).toBe(0); // the small picture's row is closed
    await expect(page.locator('[data-motion="t-title-technology"]')).toHaveCSS('opacity', '1');
    await expect(page.locator('[data-motion="t-title-ml"]')).toHaveCSS('opacity', '0');
  });
}

test('mosaic routing v11 never opens the tabs block', async ({ page }) => {
  await page.goto('/?view=component&component=grid-container-mosaic-routing&version=v11');
  await page.locator('[data-motion="grid"]').waitFor();
  await page.waitForTimeout(1500);
  const block = await page.evaluate(() => { const r = document.querySelector('[data-motion="t-block"]')!.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  expect(block).toEqual([0, 0]);
});
