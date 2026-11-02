import { test, expect } from '@playwright/test';

test.describe('Page view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=page&page=home');
  });

  test('renders 3 card instances', async ({ page }) => {
    await expect(page.locator('.card')).toHaveCount(3);
  });

  test('motion map panel shows dropdowns for each component', async ({ page }) => {
    await expect(page.locator('#motion-map-panel select')).toHaveCount(3);
  });

  test('replay all button exists', async ({ page }) => {
    await expect(page.locator('#replay-all-btn')).toBeVisible();
  });

  // The page staggers with a delay token: the default setting (delay.70), none, or another delay token.
  const delays = (page: import('@playwright/test').Page) => page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-component-id] [data-motion-target]')]
      .map(el => (el.getAnimations()[0]!.effect as KeyframeEffect).getTiming().delay as number));

  test('stagger is a select of the delay tokens, with the default and none', async ({ page }) => {
    await expect(page.locator('#stagger-input')).toHaveCount(0);
    await expect(page.locator('#stagger-select')).toHaveValue('default');
    await expect(page.locator('#stagger-select option')).toHaveText(['Default (delay.70)', 'None', 'delay.40', 'delay.70', 'delay.120']);
  });

  test('by default each component starts one default stagger (delay.70) after the one before', async ({ page }) => {
    expect(await delays(page)).toEqual([0, 70, 140]);
  });

  test('a page can use another delay token, or none, and it is in the URL', async ({ page }) => {
    await page.selectOption('#stagger-select', 'delay.120'.replace('delay.', ''));
    await expect(page).toHaveURL(/pageStagger=120/);
    expect(await delays(page)).toEqual([0, 120, 240]);
    await page.selectOption('#stagger-select', 'none');
    expect(await delays(page)).toEqual([0, 0, 0]);
    await page.selectOption('#stagger-select', 'default');
    await expect(page).not.toHaveURL(/pageStagger/);
    await page.goto('/?view=page&page=home&pageStagger=40');
    await expect(page.locator('#stagger-select')).toHaveValue('40');
    expect(await delays(page)).toEqual([0, 40, 80]);
  });

  test('the default stagger is set on the Tokens view\'s Delay tab, from the delay tokens only', async ({ page }) => {
    await page.click('.lab-nav__btn[data-view="tokens"]');
    await page.click('.lab-tokens-subtab:has-text("Delay")');
    await expect(page.locator('#stagger-control')).toHaveValue('delay.70');
    await expect(page.locator('#stagger-control option')).toHaveText(['delay.40', 'delay.70', 'delay.120']);
    await expect(page.locator('.lab-token-row', { hasText: 'delay.70' })).toHaveAttribute('title', /Used by: .*the default page stagger/);
    await page.selectOption('#stagger-control', 'delay.120');
    await expect(page).toHaveURL(/stagger=120/);
    await expect(page.locator('.lab-token-row', { hasText: 'delay.120' })).toHaveAttribute('title', /the default page stagger/);
    await expect(page.locator('.lab-token-row', { hasText: 'delay.70' })).not.toHaveAttribute('title', /the default page stagger/);

    await page.click('.lab-nav__btn[data-view="page"]');
    await expect(page.locator('#stagger-select option').first()).toHaveText('Default (delay.120)');
    expect(await delays(page)).toEqual([0, 120, 240]);
  });

  test('the default stagger holds in the URL, and an old millisecond link falls back to delay.70', async ({ page }) => {
    await page.goto('/?view=page&page=home&stagger=40');
    expect(await delays(page)).toEqual([0, 40, 80]);
    await page.goto('/?view=page&page=home&stagger=80');
    await expect(page.locator('#stagger-select option').first()).toHaveText('Default (delay.70)');
  });

  test('URL encodes motion map; reload restores state', async ({ page }) => {
    const selects = page.locator('#motion-map-panel select');
    await selects.nth(1).selectOption('v2');
    await page.waitForFunction(() => window.location.search.includes('mm='));
    const url = page.url();
    await page.goto(url);
    await expect(page.locator('#motion-map-panel select').nth(1)).toHaveValue('v2');
  });
});
