import { test, expect } from '@playwright/test';

// The homepage's background is the interactive dot field (the site's own pattern code, drawn on a canvas) behind the content, which fades in on top of it with
// no wait. It stays put as the page scrolls, fading out as the page scrolls down.
test('the pattern is drawn behind the sections, and fades out as the page scrolls', async ({ page }) => {
  await page.goto('/?view=page&page=homepage&pv=v4');
  await page.locator('[data-motion="page-intro-pattern"]').waitFor();
  await page.waitForTimeout(1500);
  const state = () => page.evaluate(() => {
    const pattern = document.querySelector('[data-motion="page-intro-pattern"]')!;
    const field = pattern.querySelector<HTMLElement>('[data-dot-field]')!;
    const sections = [...document.querySelectorAll('[data-motion-target]')].filter(e => e !== pattern);
    return { zIndex: getComputedStyle(pattern.parentElement!).zIndex, fieldOpacity: +getComputedStyle(field).opacity, sections: sections.map(e => +getComputedStyle(e).opacity), backgrounds: sections.map(e => getComputedStyle(e).backgroundColor) };
  });
  const dots = () => page.evaluate(() => { const c = document.querySelector<HTMLCanvasElement>('.page-intro-pattern canvas')!; const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++; return n; });
  const top = await state();
  expect(top.zIndex).toBe('-1');                                  // behind the sections (its slot's wrapper)
  expect(Math.min(...top.sections)).toBe(1);                      // everything is in together: nothing waits for the pattern
  expect(top.backgrounds.every(b => b === 'rgba(0, 0, 0, 0)')).toBe(true);   // and the sections let it show through
  expect(top.fieldOpacity).toBe(1);
  expect(await dots()).toBeGreaterThan(1000);                     // the dot field is really drawn
  await page.locator('.lab-page-viewport').evaluate(el => { el.scrollTop = 400; });
  await expect.poll(async () => (await state()).fieldOpacity).toBe(0);   // scrolled down: gone
  await page.locator('.lab-page-viewport').evaluate(el => { el.scrollTop = 0; });
  await expect.poll(async () => (await state()).fieldOpacity).toBe(1);   // and back at the top
});
