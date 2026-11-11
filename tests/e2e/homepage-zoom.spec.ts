import { test, expect } from '@playwright/test';

// The scroll page: the bento as the design has it; as the page scrolls the middle picture grows to fill the page's container (never over the menu) while the
// cells around it collapse; the title and the feature card come in after it.
test('the middle picture grows to the container as the page scrolls, and the cells around it collapse', async ({ page }) => {
  await page.goto('/?view=page&page=homepage-zoom&size=actual');
  await page.locator('[data-motion="p1a"]').waitFor();
  await page.waitForTimeout(1200);
  const box = (name: string) => page.evaluate(n => { const r = document.querySelector(`[data-motion="${n}"]`)!.getBoundingClientRect(); const v = document.querySelector('.lab-page-viewport')!.getBoundingClientRect(); return [Math.round(r.x - v.x), Math.round(r.y - v.y), Math.round(r.width), Math.round(r.height)]; }, name);
  const windowH = await page.locator('.lab-page-viewport').evaluate(el => el.clientHeight);
  expect(await box('p1a')).toEqual([696, 128, 352, 472]);          // at rest: as in the design
  await page.locator('.lab-page-viewport').evaluate(el => { el.scrollTop = 800; });
  await expect.poll(() => box('p1a')).toEqual([336, 32, 1072, windowH - 64]);  // the container, one window tall, on the page's margins (32px each side, as the other cards)
  expect((await box('p0a'))[2]).toBe(0);                            // the side columns have collapsed
  expect((await box('p2a'))[2]).toBe(0);
  expect((await box('i1'))[3]).toBe(0);                             // and the card under it
  await page.locator('.lab-page-viewport').evaluate(el => { el.scrollTop = 0; });
  await expect.poll(() => box('p1a')).toEqual([696, 128, 352, 472]);   // back to the design when scrolled back
});
