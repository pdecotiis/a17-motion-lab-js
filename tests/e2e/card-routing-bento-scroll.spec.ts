import { test, expect, type Page } from '@playwright/test';

// card-routing-bento v2 plays on scroll: in the homepage's page version v4 it waits, hidden, until its section scrolls into the window, then cascades in.
const WINDOW = '.lab-page-viewport';
const section = (page: Page) => page.locator('.lab-page-col').first().locator('.lab-page-item[data-component-id="card-routing-bento"]');

test('the card routing bento waits until it scrolls into view, then plays once', async ({ page }) => {
  await page.goto('/?view=page&page=homepage&pv=v4');
  await expect(section(page)).toHaveClass(/waiting/);
  expect(await section(page).evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  await section(page).evaluate(el => el.scrollIntoView({ block: 'center' }));
  await expect(section(page)).not.toHaveClass(/waiting/);
  await page.waitForTimeout(300);
  expect(await section(page).evaluate(el => el.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  // once: scrolling back up does not make it wait again
  await page.locator(WINDOW).evaluate(el => { el.scrollTop = 0; });
  await page.waitForTimeout(300);
  await expect(section(page)).not.toHaveClass(/waiting/);
});
