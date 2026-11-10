import { test, expect } from '@playwright/test';

// Elements that use the button or card preset (their hover, press and release come from tokens/presets.json): press scales, hover and press darken.
const CASES = [
  { component: 'header', version: 'v3', target: 'search', press: 'matrix(0.97, 0, 0, 0.97, 0, 0)' },
  { component: 'card-feature', version: 'v2', target: 'button', press: 'matrix(0.97, 0, 0, 0.97, 0, 0)' },
  { component: 'quote-slider', version: 'v4', target: 'button-next', press: 'matrix(0.97, 0, 0, 0.97, 0, 0)' },
  { component: 'grid-container-mosaic-routing', version: 'v11', target: 'tile-5', press: 'matrix(0.98, 0, 0, 0.98, 0, 0)' },
  { component: 'grid-container-mosaic-routing', version: 'v13', target: 't-card', press: 'matrix(0.98, 0, 0, 0.98, 0, 0)' },
  { component: 'grid-container-mosaic-routing', version: 'v13', target: 't-tab-trading', press: 'matrix(0.97, 0, 0, 0.97, 0, 0)' },
];

for (const c of CASES) {
  test(`${c.component} ${c.version}: ${c.target} hovers, presses and releases by its preset`, async ({ page }) => {
    await page.goto(`/?view=component&component=${c.component}&version=${c.version}`);
    const sel = `[data-motion="${c.target}"]`;
    await page.locator(sel).first().waitFor();
    await page.waitForTimeout(4500); // the entrance (and a hold), then the element states go live
    const read = (prop: string) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s as string)!).getPropertyValue(p as string), [sel, prop] as const);
    const fire = (type: string, onDoc = false) => page.evaluate(([s, t, doc]) => {
      const el = doc ? document : document.querySelector(s as string)!;
      el.dispatchEvent(new PointerEvent(t as string, { pointerType: 'mouse', button: 0, isPrimary: true, bubbles: t !== 'pointerenter' && t !== 'pointerleave' }));
    }, [sel, type, onDoc] as const);
    await fire('pointerenter'); await page.waitForTimeout(500);
    expect(await read('filter')).toBe('brightness(0.96)');
    await fire('pointerdown'); await page.waitForTimeout(500);
    expect(await read('transform')).toBe(c.press);
    await fire('pointerup', true); await page.waitForTimeout(600);
    expect(await read('transform')).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    await fire('pointerleave'); await page.waitForTimeout(500);
    expect(await read('filter')).toBe('brightness(1)');
  });
}
