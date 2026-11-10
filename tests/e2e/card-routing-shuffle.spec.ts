import { test, expect } from '@playwright/test';

for (const runtime of ['css', 'motion']) {
  test(`card-routing-shuffle (${runtime}): the shuffle button goes through the arrangements`, async ({ page }) => {
    await page.goto(`/?view=component&component=card-routing-shuffle&version=v1&runtime=${runtime}`);
    await page.locator('[data-motion="shuffle"]').waitFor();
    const box = (n: string) => page.evaluate(name => { const r = document.querySelector(`[data-motion="${name}"]`)!.getBoundingClientRect(); const g = document.querySelector('[data-motion="grid"]')!.getBoundingClientRect(); return [Math.round(r.x - g.x), Math.round(r.y - g.y), Math.round(r.width), Math.round(r.height)]; }, n);
    const shuffle = async () => { await page.locator('[data-motion="shuffle"]').click(); await page.waitForTimeout(1300); };
    expect(await box('p01')).toEqual([0, 0, 352, 232]);
    expect(await box('i1')).toEqual([360, 0, 352, 232]);
    await shuffle();
    expect(await box('p01')).toEqual([0, 0, 352, 472]);   // the first picture is tall now
    expect((await box('p02'))[3]).toBe(0);                 // the one under it has collapsed (its height only)
    expect((await box('p02'))[2]).toBe(352);
    for (let i = 0; i < 6; i++) await shuffle();           // layout 8
    expect(await box('i0')).toEqual([0, 240, 352, 472]);   // indigo came in from the bottom
    await shuffle();
    expect(await box('p01')).toEqual([0, 0, 352, 232]);    // and round to the first again
  });
}
