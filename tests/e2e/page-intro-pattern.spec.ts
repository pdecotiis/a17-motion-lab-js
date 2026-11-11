import { test, expect } from '@playwright/test';

// The homepage opens on the dotted background pattern; the sections wait (the page's hold, 2.5s), then fade in on top of it. The pattern never fades.
test('the pattern is there first, and the sections fade in on top of it', async ({ page }) => {
  await page.goto('/?view=page&page=homepage&pv=v4');
  await page.locator('[data-motion="page-intro-pattern"]').waitFor();
  const state = () => page.evaluate(() => {
    const pattern = document.querySelector('[data-motion="page-intro-pattern"]')!;
    const sections = [...document.querySelectorAll('[data-motion-target]')].filter(e => e !== pattern);
    return { pattern: +getComputedStyle(pattern).opacity, zIndex: getComputedStyle(pattern).zIndex, sections: sections.map(e => +getComputedStyle(e).opacity), backgrounds: sections.map(e => getComputedStyle(e).backgroundColor) };
  });
  await page.waitForTimeout(600);
  const early = await state();
  expect(early.pattern).toBe(1);
  expect(early.zIndex).toBe('-1');                       // behind the sections
  expect(Math.min(...early.sections)).toBe(0);           // the sections are still waiting
  await page.waitForTimeout(4500);
  const late = await state();
  expect(late.pattern).toBe(1);                          // the pattern stays
  expect(Math.min(...late.sections)).toBe(1);            // the sections are in
  expect(late.backgrounds.every(b => b === 'rgba(0, 0, 0, 0)')).toBe(true);   // and let it show through
});
