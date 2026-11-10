import { test, expect } from '@playwright/test';

// The card preset on the card itself (card v3: elements { root: 'card' }): hovering tints it, pressing scales and darkens it, releasing returns it,
// and the entrance has finished first. Both runtimes.
for (const runtime of ['css', 'motion']) {
  test(`card v3 (${runtime}): the card hovers, presses and releases by the card preset`, async ({ page }) => {
    await page.goto(`/?view=component&component=card&version=v3&runtime=${runtime}`);
    await page.locator('[data-motion-target]').waitFor();
    await page.waitForTimeout(3500); // the entrance (it plays when the card scrolls into view), then the element states go live
    const read = (prop: string) => page.evaluate(p => getComputedStyle(document.querySelector('[data-motion-target]')!).getPropertyValue(p), prop);
    const fire = (type: string, onDoc = false) => page.evaluate(([t, doc]) => {
      const el = doc ? document : document.querySelector('[data-motion-target]')!;
      el.dispatchEvent(new PointerEvent(t as string, { pointerType: 'mouse', button: 0, isPrimary: true, bubbles: t !== 'pointerenter' && t !== 'pointerleave' }));
    }, [type, onDoc] as const);

    await fire('pointerenter'); await page.waitForTimeout(600);
    expect(await read('filter')).toBe('brightness(0.96)');
    await fire('pointerdown'); await page.waitForTimeout(600);
    expect(await read('transform')).toBe('matrix(0.95, 0, 0, 0.95, 0, 0)');
    expect(await read('filter')).toBe('brightness(0.92)');
    await fire('pointerup', true); await page.waitForTimeout(700);
    expect(await read('filter')).toBe('brightness(0.96)');
    await fire('pointerleave'); await page.waitForTimeout(600);
    expect(await read('filter')).toBe('brightness(1)');
  });
}
