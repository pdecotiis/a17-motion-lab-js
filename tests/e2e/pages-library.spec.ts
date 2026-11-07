import { test, expect } from '@playwright/test';

// The top-level views share one page header (the view's name, large), the nav runs Components, Pages, Presets, Tokens,
// and Pages is a library of pages like Components is of components. These run on whatever the project has: with no
// pages the Pages view is the "ask Claude" screen, so the checks that need a page skip.
test.describe('the shared header and the Pages library', () => {
  test('Components, Presets and Tokens open with the same header', async ({ page }) => {
    for (const [view, title] of [['library', 'Components'], ['presets', 'Presets'], ['tokens', 'Tokens']] as const) {
      await page.goto(`/?view=${view}`);
      // A project with no components shows the "ask Claude" screen instead of the Components library.
      if (view === 'library' && (await page.locator('.lab-ask').count()) > 0) continue;
      await expect(page.locator('.lab-hero__title')).toHaveText(title);
      const box = await page.locator('.lab-hero').boundingBox();
      expect(Math.round(box!.height)).toBe(160);
      expect(Math.round(box!.x)).toBe(0);
      // The row under the header is the action bar: the same height and full width on every view.
      const bar = await page.locator('.lab-actionbar').boundingBox();
      expect(Math.round(bar!.height)).toBe(72);
      expect(Math.round(bar!.x)).toBe(0);
    }
  });

  test('Pages is a library of pages, and a card opens the page', async ({ page }) => {
    await page.goto('/?view=pages');
    test.skip((await page.locator('#pages-grid').count()) === 0, 'this project has no pages');
    await expect(page.locator('.lab-hero__title')).toHaveText('Pages');
    await expect(page.locator('.lab-nav__btn[data-view="pages"]')).toHaveAttribute('aria-current', 'page');
    const cards = page.locator('.lab-library-card');
    const total = await cards.count();
    expect(total).toBeGreaterThan(0);
    await expect(page.locator('#pages-count')).toHaveText(`${total} page${total === 1 ? '' : 's'}`);
    await expect(cards.first()).toHaveAttribute('href', /^\?view=page&page=/);
    const id = await cards.first().getAttribute('data-page');
    await cards.first().click();
    await expect(page).toHaveURL(new RegExp(`view=page&page=${id}`));
    await expect(page.locator('.lab-page-layout')).toBeVisible();
    // Back to the library by the breadcrumb, with Pages still the lit nav item.
    await expect(page.locator('#breadcrumb-pages')).toHaveText('Pages');
    await expect(page.locator('.lab-nav__btn[data-view="pages"]')).toHaveAttribute('aria-current', 'page');
    await page.click('#breadcrumb-pages');
    await expect(page.locator('#pages-grid')).toBeVisible();
  });

  test('search narrows the pages', async ({ page }) => {
    await page.goto('/?view=pages');
    test.skip((await page.locator('#pages-grid').count()) === 0, 'this project has no pages');
    await page.fill('#pages-search', 'zzz-no-such-page');
    await expect(page.locator('.lab-library-card')).toHaveCount(0);
    await expect(page.locator('#pages-count')).toHaveText('0 pages');
    await expect(page).toHaveURL(/q=zzz-no-such-page/);
  });

  test('the nav runs Components, Pages, Presets, Tokens', async ({ page }) => {
    await page.goto('/?view=tokens');
    await expect(page.locator('.lab-nav__btn')).toHaveText(['Components', 'Pages', 'Presets', 'Tokens']);
  });
});
