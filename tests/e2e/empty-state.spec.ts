import { test, expect, type Page } from '@playwright/test';

// The empty lab, drawn into the page with the lab's own module (the project has components, so it is not reached by a URL here).
const draw = (page: Page, kind: 'components' | 'pages') => page.evaluate(async (k) => {
  const { renderEmptyState } = await import('/lib/empty-state.ts' as string) as typeof import('../../lab/lib/empty-state.js');
  renderEmptyState(document.getElementById('main-content')!, k);
}, kind);

test.describe('The empty lab', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/?view=tokens'); });

  test('says there is nothing yet and what to ask Claude, with requests to copy', async ({ page }) => {
    await draw(page, 'components');
    await expect(page.locator('.lab-ask__title')).toHaveText('Nothing in the lab yet');
    await expect(page.locator('.lab-ask__lead')).toContainText('Claude');
    await expect(page.locator('.lab-ask__prompt')).toHaveCount(3);
    await expect(page.locator('.lab-ask__label')).toHaveText(['Bring in a design', 'Start from a whole page', 'Learn how it works']);
    await expect(page.locator('.lab-ask__copy').first()).toHaveText('Copy');
  });

  test('Copy answers with Copied (or says to select it, if the browser refuses), then goes back', async ({ page }) => {
    await draw(page, 'components');
    const button = page.locator('.lab-ask__copy').first();
    await button.click();
    await expect(button).toHaveText(/Copied|Select and copy/);
    await expect(button).toHaveText('Copy', { timeout: 4000 });
  });

  test('the pages one asks for a page frame', async ({ page }) => {
    await draw(page, 'pages');
    await expect(page.locator('.lab-ask__title')).toHaveText('No pages yet');
    await expect(page.locator('.lab-ask__prompt')).toHaveCount(3);
  });

  test('uses the lab\'s own look: the card is the secondary gray with no border, and nothing overflows the window', async ({ page }) => {
    await draw(page, 'components');
    expect(await page.locator('.lab-ask__prompt').first().evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
    expect(await page.locator('.lab-ask__prompt').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(245, 245, 245)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
