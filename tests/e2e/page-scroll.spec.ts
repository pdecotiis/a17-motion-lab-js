import { test, expect, type Page } from '@playwright/test';

// The page preview is a fixed-height window you scroll. A section whose version has an in-view trigger waits
// until it scrolls in; one with no trigger plays at load. `home` ships v1 (cards with no trigger specified)
// and v3 (cards that play when they scroll into view).

const WINDOW = '.lab-page-viewport';
const section = (page: Page, id: string, column = 0) => page.locator('.lab-page-col').nth(column).locator(`.lab-page-item[data-component-id="${id}"]`);
const animations = (page: Page, id: string, column = 0) => section(page, id, column).evaluate(el => el.getAnimations({ subtree: true }).length);
const scrollTo = (page: Page, where: 'top' | 'bottom', column = 0) =>
  page.locator(WINDOW).nth(column).evaluate((el, w) => { el.scrollTop = w === 'top' ? 0 : el.scrollHeight; }, where);
// The first animation on the section's root: when it starts.
const rootDelay = (page: Page, id: string) => section(page, id).evaluate(el => {
  const target = el.querySelector('[data-motion-target]')!;
  return (target.getAnimations()[0]!.effect as KeyframeEffect).getTiming().delay as number;
});

test.describe('Page preview: a window you scroll', () => {
  test('the page sits in a fixed-height window that scrolls', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v3');
    const box = page.locator(WINDOW);
    await expect(box).toHaveCSS('overflow-y', 'auto');
    const before = (await box.boundingBox())!.height;
    expect(before).toBeGreaterThanOrEqual(320);
    expect(await box.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await scrollTo(page, 'bottom');
    expect((await box.boundingBox())!.height).toBe(before);
  });

  test('a version with no trigger plays at load, even below the fold', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v1');
    await expect(page.locator('.lab-page-item--waiting')).toHaveCount(0);
    for (const id of ['card-1', 'card-2', 'card-3']) expect(await animations(page, id)).toBeGreaterThan(0);
  });

  test('a version with an in-view trigger waits until its section scrolls in, then plays', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v3');
    await expect(section(page, 'card-1')).not.toHaveClass(/waiting/);
    await expect(section(page, 'card-3')).toHaveClass(/waiting/);
    expect(await animations(page, 'card-1')).toBeGreaterThan(0);
    expect(await animations(page, 'card-3')).toBe(0);
    await expect(section(page, 'card-3')).toBeHidden();

    await scrollTo(page, 'bottom');
    await expect(section(page, 'card-3')).not.toHaveClass(/waiting/);
    await expect(section(page, 'card-3')).toBeVisible();
    expect(await animations(page, 'card-3')).toBeGreaterThan(0);
  });

  test('once: scrolling back up does not make a played section wait again', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v3');
    await scrollTo(page, 'bottom');
    await expect(section(page, 'card-3')).not.toHaveClass(/waiting/);
    await scrollTo(page, 'top');
    await page.waitForTimeout(200);
    await expect(section(page, 'card-3')).not.toHaveClass(/waiting/);
  });

  test('sections in view as the page opens are staggered by their place; one that scrolls in plays on its own', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v3');
    await expect(section(page, 'card-2')).not.toHaveClass(/waiting/);
    expect(await rootDelay(page, 'card-1')).toBe(0);
    expect(await rootDelay(page, 'card-2')).toBe(80);
    await scrollTo(page, 'bottom');
    await expect(section(page, 'card-3')).not.toHaveClass(/waiting/);
    expect(await rootDelay(page, 'card-3')).toBe(0);
  });

  test('Replay All scrolls back to the top and makes the sections wait again', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v3');
    await scrollTo(page, 'bottom');
    await expect(section(page, 'card-3')).not.toHaveClass(/waiting/);
    await page.click('#replay-all-btn');
    expect(await page.locator(WINDOW).evaluate(el => el.scrollTop)).toBe(0);
    await expect(section(page, 'card-3')).toHaveClass(/waiting/);
    expect(await animations(page, 'card-3')).toBe(0);
  });

  test('the Motion Map says which slots play on scroll, and changing one starts that section over', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v3');
    await expect(page.locator('#motion-map-panel label')).toHaveText(['card-1 · plays on scroll', 'card-2 · plays on scroll', 'card-3 · plays on scroll']);
    await page.selectOption('#motion-map-panel select >> nth=2', 'v1');
    await expect(page.locator('#motion-map-panel label').nth(2)).toHaveText('card-3');
    // v1 has no trigger: the section below the fold plays now, not when it scrolls in
    await expect(section(page, 'card-3')).not.toHaveClass(/waiting/);
    expect(await animations(page, 'card-3')).toBeGreaterThan(0);
    await page.selectOption('#motion-map-panel select >> nth=2', 'v3');
    await expect(section(page, 'card-3')).toHaveClass(/waiting/);
  });

  test('each compared page has its own window and scrolls on its own', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v1&compare=v3');
    await expect(page.locator(WINDOW)).toHaveCount(2);
    // left, v1: everything plays at load. right, v3: card-3 waits.
    await expect(section(page, 'card-3', 0)).not.toHaveClass(/waiting/);
    await expect(section(page, 'card-3', 1)).toHaveClass(/waiting/);
    await scrollTo(page, 'bottom', 1);
    await expect(section(page, 'card-3', 1)).not.toHaveClass(/waiting/);
    expect(await page.locator(WINDOW).nth(0).evaluate(el => el.scrollTop)).toBe(0);
  });

  test('a page with no scroll trigger needs no scrolling: nothing waits', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v2');
    await expect(page.locator('.lab-page-item--waiting')).toHaveCount(0);
  });

  test('loads and scrolls without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=page&page=home&pv=v3&compare=v1');
    await scrollTo(page, 'bottom', 0);
    await scrollTo(page, 'top', 0);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
});
