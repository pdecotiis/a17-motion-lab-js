import { test, expect } from '@playwright/test';

// An element that uses a preset's hover and press (side-panel v3: the × uses `ui`) has states of its own, apart from the component's:
// hovering and pressing it tint and scale it, and the panel stays open the whole time. Both runtimes.
for (const runtime of ['css', 'motion']) {
  test(`side-panel v3 (${runtime}): the × hovers, presses and releases by the ui preset while the panel stays open`, async ({ page }) => {
    await page.goto(`/?view=component&component=side-panel&version=v3&runtime=${runtime}`);
    await page.locator('[data-motion="close"]').waitFor();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'open', exact: true }).click();
    await page.waitForTimeout(2500); // the panel opens; the element states go live when everything has settled
    const read = (prop: string) => page.evaluate(p => getComputedStyle(document.querySelector('[data-motion="close"]')!).getPropertyValue(p), prop);
    const panelState = () => page.evaluate(() => document.querySelector<HTMLElement>('[data-motion-target]')!.dataset['state']);
    const fire = (type: string, onDoc = false) => page.evaluate(([t, doc]) => {
      const el = doc ? document : document.querySelector('[data-motion="close"]')!;
      el.dispatchEvent(new PointerEvent(t as string, { pointerType: 'mouse', button: 0, isPrimary: true, bubbles: t !== 'pointerenter' && t !== 'pointerleave' }));
    }, [type, onDoc] as const);

    await fire('pointerenter'); await page.waitForTimeout(500);
    expect(await read('filter')).toBe('brightness(0.96)');
    await fire('pointerdown'); await page.waitForTimeout(500);
    expect(await read('transform')).toBe('matrix(0.95, 0, 0, 0.95, 0, 0)');
    expect(await read('filter')).toBe('brightness(0.92)');
    await fire('pointerup', true); await page.waitForTimeout(600);
    expect(await read('filter')).toBe('brightness(0.96)');
    await fire('pointerleave'); await page.waitForTimeout(500);
    expect(await read('filter')).toBe('brightness(1)');
    expect(await panelState()).toBe('open'); // the component never left its own state
  });
}
