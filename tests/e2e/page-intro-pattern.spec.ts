import { test, expect } from '@playwright/test';

// The homepage opens on the dotted pattern; the sections wait (the page's hold, 2.5s), then the pattern fades away as they fade in.
test('the pattern shows first, then fades away as the sections fade in', async ({ page }) => {
  await page.goto('/?view=page&page=homepage&pv=v4');
  await page.locator('[data-motion="page-intro-pattern"]').waitFor();
  const opacities = () => page.evaluate(() => {
    const pattern = document.querySelector('[data-motion="page-intro-pattern"]')!;
    const sections = [...document.querySelectorAll('[data-motion-target]')].filter(e => e !== pattern);
    return { pattern: +getComputedStyle(pattern).opacity, sections: sections.map(e => +getComputedStyle(e).opacity) };
  });
  await page.waitForTimeout(600);
  const early = await opacities();
  expect(early.pattern).toBe(1);
  expect(Math.min(...early.sections)).toBe(0);          // the sections are still waiting
  await page.waitForTimeout(4500);
  const late = await opacities();
  expect(late.pattern).toBe(0);                         // the pattern has gone
  expect(Math.min(...late.sections)).toBe(1);           // and the sections are in
});
