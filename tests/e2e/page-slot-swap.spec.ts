import { test, expect, type Page } from '@playwright/test';

// A page version can leave a slot out ("none") or put another component's version in its place ("side-panel@v1"), and a version whose in-view trigger
// is `each` plays each part as it scrolls in. `home` ships card-1 to card-3.
const WINDOW = '.lab-page-viewport';
const item = (page: Page, id: string) => page.locator('.lab-page-col').first().locator(`.lab-page-item[data-component-id="${id}"]`);
const mm = (map: Record<string, string>) => Buffer.from(JSON.stringify(map)).toString('base64');

test('a slot can be left out of a page version', async ({ page }) => {
  await page.goto(`/?view=page&page=home&mm=${mm({ 'card-2': 'none' })}`);
  await expect(item(page, 'card-2')).toHaveClass(/lab-page-item--left-out/);
  await expect(item(page, 'card-2')).toBeHidden();
  await expect(item(page, 'card-1')).toBeVisible();
  await expect(page.locator('#motion-map-panel label').nth(1)).toHaveText('card-2 · left out');
});

test('another component can take a slot\'s place', async ({ page }) => {
  await page.goto(`/?view=page&page=home&mm=${mm({ 'card-3': 'side-panel@v1' })}`);
  await expect(item(page, 'card-3').locator('[data-motion="close"]')).toHaveCount(1);   // the side panel's × is where card-3 was
  await expect(item(page, 'card-3').locator('.card')).toHaveCount(0);
  await expect(item(page, 'card-1').locator('.card')).toHaveCount(1);
});

test('the Motion Map offers leaving a slot out and every other component', async ({ page }) => {
  await page.goto('/?view=page&page=home');
  const select = page.locator('#motion-map-panel select').nth(1);
  await expect(select.locator('optgroup[label="Leave out"] option')).toHaveCount(1);
  await expect(select.locator('optgroup[label="Replace with side-panel"] option').first()).toBeAttached();
  await select.selectOption('none');
  await expect(item(page, 'card-2')).toBeHidden();
  await select.selectOption('side-panel@v1');
  await expect(item(page, 'card-2').locator('[data-motion="close"]')).toHaveCount(1);
});

test('each: the parts of a section wait for their own turn on scroll, then play, once', async ({ page }) => {
  await page.goto(`/?view=page&page=home&mm=${mm({ 'card-1': 'v4', 'card-2': 'v4', 'card-3': 'v4' })}`);
  const title3 = item(page, 'card-3').locator('[data-motion="title"]');
  await expect(item(page, 'card-3')).not.toHaveClass(/waiting/);          // the section is not held back as a whole
  await expect(title3).toHaveCSS('opacity', '0');                          // but its title waits, out of view
  expect(await title3.evaluate(el => el.getAnimations().length)).toBe(0);
  await title3.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await expect.poll(() => title3.evaluate(el => el.getAnimations().length)).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  await expect(title3).toHaveCSS('opacity', '1');
  await page.locator(WINDOW).evaluate(el => { el.scrollTop = 0; });
  await page.waitForTimeout(300);
  await expect(title3).toHaveCSS('opacity', '1');                          // once
});
