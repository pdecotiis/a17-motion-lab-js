import { test, expect } from '@playwright/test';

for (const runtime of ['css', 'motion']) {
  test(`card-routing-shuffle (${runtime}): the shuffle button goes through the arrangements`, async ({ page }) => {
    await page.goto(`/?view=component&component=card-routing-shuffle&version=v1&runtime=${runtime}`);
    await page.locator('[data-motion="shuffle"]').waitFor();
    await page.waitForTimeout(1200);                       // the colour cards come in first
    const box = (n: string) => page.evaluate(name => { const r = document.querySelector(`[data-motion="${name}"]`)!.getBoundingClientRect(); const g = document.querySelector('[data-motion="grid"]')!.getBoundingClientRect(); return [Math.round(r.x - g.x), Math.round(r.y - g.y), Math.round(r.width), Math.round(r.height)]; }, n);
    const shuffle = async () => { await page.locator('[data-motion="shuffle"]').click(); await page.waitForTimeout(1300); };
    expect(await box('y0')).toEqual([0, 0, 352, 232]);     // the page: a card on top...
    expect(await box('i1')).toEqual([360, 480, 352, 232]); // ...at the bottom in the middle...
    expect(await box('g2')).toEqual([720, 0, 352, 232]);   // ...and on top
    await shuffle();                                       // the first card takes two rows, its picture gives way
    expect(await box('y0')).toEqual([0, 0, 352, 472]);
    expect(await box('p0')).toEqual([0, 480, 352, 232]);
    for (let i = 0; i < 4; i++) await shuffle();           // layout 6: no cards at all
    expect((await box('y0'))[3]).toBe(0);
    expect(await box('p0')).toEqual([0, 0, 352, 712]);
    for (let i = 0; i < 3; i++) await shuffle();
    expect(await box('y0')).toEqual([0, 0, 352, 232]);     // and round to the first again
  });
}
