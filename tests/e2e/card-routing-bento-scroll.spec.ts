import { test, expect, type Page } from '@playwright/test';

// Homepage page version v4 replaces the tab bento (the slot `grid-container-mosaic-routing`) with card-routing-bento v2, whose cells each play as they
// scroll into view (not the whole bento at once).
const WINDOW = '.lab-page-viewport';
const slot = (page: Page) => page.locator('.lab-page-col').first().locator('.lab-page-item[data-component-id="grid-container-mosaic-routing"]');

test('the card routing bento takes the tab bento\'s place, and each cell plays as it scrolls in', async ({ page }) => {
  await page.goto('/?view=page&page=homepage&pv=v4');
  // the slot shows the new component, not the tab bento
  await expect(slot(page).locator('[data-motion="cell-9"]')).toHaveCount(1);
  await expect(slot(page).locator('[data-motion="t-block"]')).toHaveCount(0);
  // the section is not held back, but a cell far below the window waits, hidden, with nothing playing on it
  await expect(slot(page)).not.toHaveClass(/waiting/);
  const last = slot(page).locator('[data-motion="cell-9"]');
  await expect(last).toHaveCSS('opacity', '0');
  expect(await last.evaluate(el => el.getAnimations().length)).toBe(0);
  // scrolled to, it plays, and stays once played
  await last.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await expect.poll(() => last.evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  await expect(last).toHaveCSS('opacity', '1');
  await page.locator(WINDOW).evaluate(el => { el.scrollTop = 0; });
  await page.waitForTimeout(300);
  await expect(last).toHaveCSS('opacity', '1');
});

test('the other page versions keep the tab bento in that slot', async ({ page }) => {
  await page.goto('/?view=page&page=homepage&pv=v1');
  await expect(slot(page).locator('[data-motion="t-block"]')).toHaveCount(1);
});
