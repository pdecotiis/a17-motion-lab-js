import { test, expect } from '@playwright/test';

// The homepage opening: the bento fills the window with no menu (the logo is already there), goes through three scenes, then the menu slides in, the bento
// narrows to its place beside it, and the rest of the page fades in. The first frame is recorded from the page's start (so a loaded machine cannot make the
// test miss it) and compared with where the page settles.
test('the page opens on the bento, then the menu slides in and the page settles', async ({ page }) => {
  await page.addInitScript(() => {
    const frames: unknown[] = [];
    (window as unknown as Record<string, unknown>)['__frames'] = frames;
    const sample = (): void => {
      const q = (s: string): Element | null => document.querySelector(s);
      const menu = q('[data-motion="menu"]'), logo = q('[data-motion="menu"] [data-motion="logo"]'), grid = q('[data-motion="grid"]'), title = q('[data-motion="page-header-title"]'), view = q('.lab-page-viewport');
      if (menu && logo && grid && title && view) {
        const v = view.getBoundingClientRect(), l = logo.getBoundingClientRect(), g = grid.getBoundingClientRect();
        frames.push({ menu: Math.round(menu.getBoundingClientRect().width), logo: [Math.round(l.x - v.x), Math.round(l.y - v.y)], grid: [Math.round(g.width), Math.round(g.height)], title: +getComputedStyle(title).opacity });
      }
      if (frames.length < 400) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/?view=page&page=homepage-intro&size=actual');
  await page.waitForTimeout(5600);   // three scenes, each shown in full for a second, then the settle
  const frames = await page.evaluate(() => (window as unknown as Record<string, { menu: number; logo: number[]; grid: number[]; title: number }[]>)['__frames']!);
  const first = frames[0]!, last = frames[frames.length - 1]!;
  expect(first.menu).toBe(0);                            // no menu yet
  expect(first.logo).toEqual([32, 32]);                  // but the logo is there
  expect(first.grid).toEqual([1376, 914]);               // the bento fills the window, in the proportions of the settled page
  expect(first.title).toBe(0);                           // and the rest of the page waits
  expect(last.menu).toBe(304);                           // the menu has slid in
  expect(last.logo).toEqual([24, 24]);                   // the logo's padding has settled into its place in it
  expect(last.grid).toEqual([1072, 712]);                // the bento has narrowed to its place, keeping its proportions
  expect(last.title).toBe(1);                            // and the page is in
});
