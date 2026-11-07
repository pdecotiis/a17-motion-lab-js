import { test, expect } from '@playwright/test';

// The homepage as the Figma frame lays it out (the xl breakpoint with the side menu open): the 304px menu at the left, and beside it the
// 1136px column that starts with the header, then the page title and the mosaic.
test.describe('Homepage layout', () => {
  test('the menu sits at the left and the header starts the column beside it', async ({ page }) => {
    await page.goto('/?view=page&page=homepage');
    const box = async (id: string) => (await page.locator(`.lab-page-item[data-component-id="${id}"]`).boundingBox())!;
    await expect(page.locator('.lab-page-item[data-component-id="menu"]')).toBeVisible();
    const [menu, header, title, mosaic] = [await box('menu'), await box('header'), await box('page-header-title'), await box('grid-container-mosaic-routing')];
    expect(Math.round(menu.width)).toBe(304);
    expect(Math.round(header.x - menu.x)).toBe(304);          // the column starts where the menu ends
    expect(Math.round(header.y)).toBe(Math.round(menu.y));    // both start at the top of the page
    expect(Math.round(header.width)).toBe(1136);
    expect(Math.round(title.y - header.y)).toBe(80);          // the header is 80px tall, flush above the title
    expect(Math.round(mosaic.x)).toBe(Math.round(header.x));  // the sections are in the column, not under the menu
  });

  test('the page is 1:1 with the Figma frame: 1440px wide, never scaled, and whole in a 1440px window', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/?view=page&page=homepage');
    await expect(page.locator('.lab-page-item[data-component-id="menu"]')).toBeVisible();
    const grid = page.locator('.lab-page-grid');
    expect(await grid.evaluate(el => (el as HTMLElement).style.zoom)).toBe('');
    expect(Math.round((await grid.boundingBox())!.width)).toBe(1440);
    const stage = page.locator('#page-stage');
    expect(await stage.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);   // nothing scrolls sideways in a 1440px window
    const edge = await page.locator('.lab-page-item[data-component-id="header"]').boundingBox();
    expect(Math.round(edge!.x + edge!.width)).toBeLessThanOrEqual(1440);              // the content ends inside the window
    await page.setViewportSize({ width: 1000, height: 900 });                          // a narrower window scrolls sideways, still at 1:1
    await page.waitForTimeout(200);
    expect(await stage.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await grid.evaluate(el => (el as HTMLElement).style.zoom)).toBe('');
  });
});
