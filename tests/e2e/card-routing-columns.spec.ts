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

// v2: the same sequence with square pictures: 352 x 352, a column 595 tall, the picture itself the square throughout (the container only uncovers it).
test('card-routing-columns v2: the pictures open to squares', async ({ page }) => {
  await page.goto('/?view=component&component=card-routing-columns&version=v2');
  await page.locator('[data-motion="grid"]').waitFor();
  const box = (n: string) => page.evaluate(name => { const r = document.querySelector(`[data-motion="${name}"]`)!.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }, n);
  await page.waitForTimeout(3500);
  expect(await box('image-1')).toEqual([352, 352]);
  expect(await box('image-2')).toEqual([352, 352]);
  expect(await box('photo-1')).toEqual([352, 352]);   // the picture is the square too
  expect(await box('col-2')).toEqual([352, 595]);     // 235 + 8 + 352
  await page.getByRole('button', { name: 'cards', exact: true }).click();
  await page.waitForTimeout(900);
  expect((await box('image-1'))[1]).toBe(0);
  expect((await box('photo-1'))[1]).toBe(352);         // still the full square: it is uncovered, not squashed
});

// v3: click a picture and the columns trade width (600 against 228 + 228); a card brings the equal columns back; every card stays visible throughout.
for (const runtime of ['css', 'motion']) {
  test(`card-routing-columns v3 (${runtime}): clicking a picture rearranges the bento, and every card is in every arrangement`, async ({ page }) => {
    await page.goto(`/?view=component&component=card-routing-columns&version=v3&runtime=${runtime}`);
    await page.locator('[data-motion="grid"]').waitFor();
    await page.waitForTimeout(3800); // the cards, the beat, the pictures: three squares
    const w = (n: string) => page.evaluate(name => Math.round(document.querySelector(`[data-motion="${name}"]`)!.getBoundingClientRect().width), n);
    const h = (n: string) => page.evaluate(name => Math.round(document.querySelector(`[data-motion="${name}"]`)!.getBoundingClientRect().height), n);
    expect([await w('col-1'), await w('col-2'), await w('col-3')]).toEqual([352, 352, 352]);
    expect(await h('image-1')).toBe(352);
    await page.locator('[data-motion="image-2"]').click();
    await page.waitForTimeout(1200);
    expect([await w('col-1'), await w('col-2'), await w('col-3')]).toEqual([228, 600, 228]);
    expect(await h('image-1')).toBe(352);                       // the pictures keep their height
    expect([await h('col-1'), await h('col-2'), await h('col-3')]).toEqual([595, 595, 595]); // and so does the bento, whatever the widths
    for (const card of ['card-1', 'card-2', 'card-3']) expect(await w(card)).toBeGreaterThanOrEqual(228); // each card is still there
    await page.locator('[data-motion="image-3"]').click();
    await page.waitForTimeout(1200);
    expect([await w('col-1'), await w('col-2'), await w('col-3')]).toEqual([228, 228, 600]);
    await page.locator('[data-motion="card-1"]').click();
    await page.waitForTimeout(1200);
    expect([await w('col-1'), await w('col-2'), await w('col-3')]).toEqual([352, 352, 352]);
  });
}
