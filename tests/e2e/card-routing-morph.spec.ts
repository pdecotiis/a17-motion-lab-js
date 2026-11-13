import { test, expect } from '@playwright/test';

// the bento of the homepage opening: three arrangements in two columns; every change opens the cells of the next one and closes the ones of the one that goes, in place, and the big picture opens
// from between the card and the row (slide 1 to 2 at the left, slide 2 to 3 at the right), as in the shuffle bento
const CELLS: Record<number, string[]> = { 1: ['m-card', 'm-row', 'm-large'], 2: ['t-large', 't-row', 't-card'], 3: ['e-card', 'e-row', 'e-large'] };
for (const runtime of ['css', 'motion']) {
  test(`card-routing-morph (${runtime}): renders, and each change opens the next arrangement in place`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`/?view=component&component=card-routing-morph&version=v1&runtime=${runtime}`);
    await page.locator('[data-motion="next"]').waitFor();
    await page.waitForTimeout(5200);   // the arrangement and its controls come in, and the first move into slide-1
    const box = (id: string) => page.evaluate(cell => {
      const stage = document.querySelector('[data-motion="stage"]')!.getBoundingClientRect();
      const r = document.querySelector(`[data-motion="${cell}"]`)!.getBoundingClientRect();
      return { top: Math.round(r.top - stage.top), bottom: Math.round(r.bottom - stage.top), h: Math.round(r.height), stage: Math.round(stage.height) };
    }, id);
    const state = () => page.evaluate(() => document.querySelector('.card-routing-morph')!.getAttribute('data-state'));
    expect(await state()).toBe('slide-1');
    for (const [from, to] of [[1, 2], [2, 3], [3, 1]] as const) {
      await page.locator('[data-motion="next"]').click();
      await page.waitForTimeout(250);
      for (const id of CELLS[to]!) expect((await box(id)).h, `${id} is opening`).toBeGreaterThan(0);
      if (from === 1) { const b = await box('t-large'); expect(b.top).toBeGreaterThan(0); expect(b.bottom).toBeLessThan(b.stage); }   // trading's big picture opens between the card and the row
      if (from === 2) { const b = await box('e-large'); expect(b.top).toBeGreaterThan(0); expect(b.bottom).toBeLessThan(b.stage); }   // and technology's between trading's row and card
      await page.waitForTimeout(900);
      for (const id of CELLS[from]!) expect((await box(id)).h, `${id} has closed`).toBeLessThanOrEqual(1);
      const big = CELLS[to]!.find(id => id.endsWith('large'))!;
      expect((await box(big)).h).toBeGreaterThanOrEqual((await box(big)).stage - 1);   // the big picture fills its column
    }
    expect(await state()).toBe('slide-1');   // round to the first again
    expect(errors).toHaveLength(0);
  });
}
