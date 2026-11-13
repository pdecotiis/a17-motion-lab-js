import { test, expect } from '@playwright/test';

// the bento of the homepage opening: three arrangements, and every change opens the next one from the bottom of the stage, even the one that starts over
for (const runtime of ['css', 'motion']) {
  test(`card-routing-morph (${runtime}): renders, and each change grows the next panel up from the bottom`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`/?view=component&component=card-routing-morph&version=v1&runtime=${runtime}`);
    await page.locator('[data-motion="next"]').waitFor();
    await page.waitForTimeout(5200);   // the arrangement and its controls come in, and the first move into slide-1
    const boxes = () => page.evaluate(() => {
      const stage = document.querySelector('[data-motion="stage"]')!.getBoundingClientRect();
      return [1, 2, 3].map(n => { const r = document.querySelector(`[data-motion="panel-${n}"]`)!.getBoundingClientRect(); return [Math.round(r.top - stage.top), Math.round(r.bottom - stage.top), Math.round(stage.height)]; });
    });
    const state = () => page.evaluate(() => document.querySelector('.card-routing-morph')!.getAttribute('data-state'));
    expect(await state()).toBe('slide-1');
    for (const [from, to] of [[1, 2], [2, 3], [3, 1]] as const) {
      await page.locator('[data-motion="next"]').click();
      await page.waitForTimeout(250);
      const mid = await boxes();
      const incoming = mid[to - 1]!, outgoing = mid[from - 1]!;
      expect(incoming[1]).toBeGreaterThanOrEqual(incoming[2]! - 1);   // the new one grows from the bottom edge of the stage
      expect(incoming[0]).toBeGreaterThan(0);                         // and is not yet all the way up
      expect(outgoing[0]).toBe(0);                                    // the one that goes closes at the top
      expect(outgoing[1]).toBeLessThan(outgoing[2]!);
      await page.waitForTimeout(900);
      const done = await boxes();
      expect(done[to - 1]).toEqual([0, done[to - 1]![2], done[to - 1]![2]]);
    }
    expect(await state()).toBe('slide-1');   // round to the first again
    expect(errors).toHaveLength(0);
  });
}
