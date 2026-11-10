import { test, expect } from '@playwright/test';

for (const runtime of ['css', 'motion']) {
  test(`card-routing-shuffle (${runtime}): the shuffle button goes through the arrangements`, async ({ page }) => {
    await page.goto(`/?view=component&component=card-routing-shuffle&version=v1&runtime=${runtime}`);
    await page.locator('[data-motion="shuffle"]').waitFor();
    const box = (n: string) => page.evaluate(name => { const r = document.querySelector(`[data-motion="${name}"]`)!.getBoundingClientRect(); const g = document.querySelector('[data-motion="grid"]')!.getBoundingClientRect(); return [Math.round(r.x - g.x), Math.round(r.y - g.y), Math.round(r.width), Math.round(r.height)]; }, n);
    expect(await box('c1')).toEqual([0, 0, 352, 232]);
    expect(await box('c2')).toEqual([360, 0, 352, 232]);
    await page.locator('[data-motion="shuffle"]').click();
    await page.waitForTimeout(1500);
    expect(await box('c1')).toEqual([0, 0, 352, 472]);   // the first picture is tall now
    expect((await box('c4'))[3]).toBe(0);                 // the one it covered has shrunk away
    for (let i = 0; i < 5; i++) { await page.locator('[data-motion="shuffle"]').click(); await page.waitForTimeout(1300); }
    expect(await box('c1')).toEqual([0, 0, 712, 232]);   // layout 7: wide picture on top
    for (let i = 0; i < 2; i++) { await page.locator('[data-motion="shuffle"]').click(); await page.waitForTimeout(1300); }
    expect(await box('c1')).toEqual([0, 0, 352, 232]);   // and round to the first again
  });
}
