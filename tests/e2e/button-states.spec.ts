import { test, expect } from '@playwright/test';

// The round icon buttons' hover, press and release (Figma presets frame): press scales to 97%, release returns to 100%,
// and where the Figma variant has a hover fill, the fill changes on hover.
const CASES = [
  { component: 'header', version: 'v3', button: 'search', fill: 'search-fill', hover: 'rgba(0, 0, 0, 0.035)' },
  { component: 'card-feature', version: 'v2', button: 'button', fill: 'button-fill', hover: 'rgba(0, 0, 0, 0.04)' },
  { component: 'quote-slider', version: 'v4', button: 'button-next', fill: null, hover: null },
];

for (const c of CASES) {
  test(`${c.component} ${c.version}: ${c.button} presses to 97% and releases`, async ({ page }) => {
    await page.goto(`/?view=component&component=${c.component}&version=${c.version}`);
    const button = page.locator(`[data-motion="${c.button}"]`).first();
    await button.waitFor();
    await page.waitForTimeout(2500); // the entrance, then the states go live
    const read = (sel: string, prop: string) => page.evaluate(([s, p]) => getComputedStyle(document.querySelector(s)!).getPropertyValue(p), [sel, prop] as const);
    const fire = (type: string, onDoc = false) => page.evaluate(([sel, t, doc]) => {
      const el = doc ? document : document.querySelector(sel)!;
      el.dispatchEvent(new PointerEvent(t, { pointerType: 'mouse', button: 0, isPrimary: true, bubbles: t !== 'pointerenter' && t !== 'pointerleave' }));
    }, [`[data-motion="${c.button}"]`, type, onDoc] as const);
    const sel = `[data-motion="${c.button}"]`;
    if (c.fill) {
      await fire('pointerenter'); await page.waitForTimeout(300);
      expect(await read(`[data-motion="${c.fill}"]`, 'background-color')).toBe(c.hover);
    }
    await fire('pointerdown'); await page.waitForTimeout(300);
    expect(await read(sel, 'transform')).toBe('matrix(0.97, 0, 0, 0.97, 0, 0)');
    await fire('pointerup', true); await page.waitForTimeout(400);
    expect(await read(sel, 'transform')).toBe('matrix(1, 0, 0, 1, 0, 0)');
  });
}
