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
});
