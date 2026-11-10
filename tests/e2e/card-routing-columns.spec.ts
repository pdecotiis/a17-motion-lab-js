import { test, expect } from '@playwright/test';

// Three colour cards, a quick beat, then each column's picture opens (the middle column's above its card, pushing the card down). Both runtimes.
for (const runtime of ['css', 'motion']) {
  test(`card-routing-columns v1 (${runtime}): the cards show first, then the pictures open into the second layout`, async ({ page }) => {
    await page.goto(`/?view=component&component=card-routing-columns&version=v1&runtime=${runtime}`);
    await page.locator('[data-motion="grid"]').waitFor();
    const box = (n: string) => page.evaluate(name => { const r = document.querySelector(`[data-motion="${name}"]`)!.getBoundingClientRect(); const c = document.querySelector('[data-motion="col-2"]')!.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.y - c.y)]; }, n);
    await page.waitForTimeout(3500);                         // the entrance, the beat, the pictures opening
    await page.getByRole('button', { name: 'cards', exact: true }).click();
    await page.waitForTimeout(900);
    expect((await box('image-1'))[1]).toBe(0);               // the cards alone
    expect(await box('card-2')).toEqual([352, 235, 0]);
    await page.getByRole('button', { name: 'open', exact: true }).click();
    await page.waitForTimeout(1500);
    expect(await box('image-1')).toEqual([352, 469, 243]);   // the picture below its card
    expect(await box('image-2')).toEqual([352, 469, 0]);     // the middle picture above its card
    expect(await box('card-2')).toEqual([352, 235, 477]);    // which has moved to the bottom
  });
}
