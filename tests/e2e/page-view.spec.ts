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

  // The page staggers with a delay token: the default setting (delay.80), none, or another delay token.
  const delays = (page: import('@playwright/test').Page) => page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-component-id] [data-motion-target]')]
      .map(el => (el.getAnimations()[0]!.effect as KeyframeEffect).getTiming().delay as number));

  test('stagger is a select of the delay tokens, with the default and none', async ({ page }) => {
    await expect(page.locator('#stagger-input')).toHaveCount(0);
    await expect(page.locator('#stagger-select')).toHaveValue('default');
    await expect(page.locator('#stagger-select option')).toHaveText(['Default (delay.80)', 'None', 'delay.40', 'delay.80', 'delay.120']);
  });

  test('by default each component starts one default stagger (delay.80) after the one before', async ({ page }) => {
    expect(await delays(page)).toEqual([0, 80, 160]);
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
    await expect(page.locator('#stagger-control')).toHaveValue('delay.80');
    await expect(page.locator('#stagger-control option')).toHaveText(['delay.40', 'delay.80', 'delay.120']);
    await expect(page.locator('.lab-token-row', { hasText: 'delay-80' })).toHaveAttribute('title', /Used by: .*the default page stagger/);
    await page.selectOption('#stagger-control', 'delay.120');
    await expect(page).toHaveURL(/stagger=120/);
    await expect(page.locator('.lab-token-row', { hasText: 'delay-120' })).toHaveAttribute('title', /the default page stagger/);
    await expect(page.locator('.lab-token-row', { hasText: 'delay-80' })).not.toHaveAttribute('title', /the default page stagger/);

    await page.click('.lab-nav__btn[data-view="pages"]');
    await page.locator('.lab-library-card').first().click();
    await expect(page.locator('#stagger-select option').first()).toHaveText('Default (delay.120)');
    expect(await delays(page)).toEqual([0, 120, 240]);
  });

  test('the default stagger holds in the URL, and an old millisecond link falls back to delay.80', async ({ page }) => {
    await page.goto('/?view=page&page=home&stagger=40');
    expect(await delays(page)).toEqual([0, 40, 80]);
    await page.goto('/?view=page&page=home&stagger=80');
    await expect(page.locator('#stagger-select option').first()).toHaveText('Default (delay.80)');
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

// The example pane fills the space and the detail panel is always at the right of the window, whatever the page's width.
test.describe('the page view\'s two panes', () => {
  for (const width of [900, 1600]) {
    test(`the detail panel is at the right edge and the example pane fills the rest at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/?view=page');
      const stage = (await page.locator('#page-stage').boundingBox())!;
      const rail = (await page.locator('.lab-sidebar').boundingBox())!;
      expect(Math.round(rail.x + rail.width)).toBe(width - 16);           // against the right edge, inside the page padding
      expect(Math.round(rail.width)).toBe(360);
      expect(rail.x).toBeGreaterThanOrEqual(stage.x + stage.width);
      expect(Math.round(stage.x + stage.width + 16)).toBe(Math.round(rail.x)); // the pane runs right up to the panel
    });
  }
});

test.describe('dragging the detail panel', () => {
  test('the handle changes the panel width, it is kept after a reload, and a double click resets it', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto('/?view=page');
    const rail = page.locator('.lab-sidebar');
    const handle = page.locator('.lab-panel-resizer');
    expect(Math.round((await rail.boundingBox())!.width)).toBe(360);
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x - 120, box.y + 200, { steps: 5 });
    await page.mouse.up();
    const wider = Math.round((await rail.boundingBox())!.width);
    expect(wider).toBeGreaterThan(440);
    await page.reload();
    expect(Math.round((await rail.boundingBox())!.width)).toBe(wider);
    const again = (await page.locator('.lab-panel-resizer').boundingBox())!;
    await page.mouse.dblclick(again.x + again.width / 2, again.y + 200);
    expect(Math.round((await rail.boundingBox())!.width)).toBe(360);
    // the keyboard nudges it, within limits
    await page.locator('.lab-panel-resizer').focus();
    await page.keyboard.press('ArrowLeft');
    expect(Math.round((await rail.boundingBox())!.width)).toBe(376);
  });
});

test.describe('Fit to window', () => {
  test('one page is shown at its real size by default, and Fit scales it down to the pane, saying by how much', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('/?view=page');
    const grid = page.locator('.lab-page-grid');
    const stage = page.locator('#page-stage');
    await expect(page.locator('#page-size-select')).toHaveValue('actual');
    expect(await grid.evaluate(el => (el as HTMLElement).style.zoom)).toBe('');
    await page.selectOption('#page-size-select', 'fit');
    await expect(page).toHaveURL(/size=fit/);
    await expect(page.locator('#page-size-select')).toHaveValue('fit');
    const zoom = Number(await grid.evaluate(el => (el as HTMLElement).style.zoom));
    expect(zoom).toBeGreaterThan(0);
    expect(zoom).toBeLessThanOrEqual(1);
    await expect(page.locator('#page-size-select option[value="fit"]')).toHaveText(`Fit to window (${Math.round(zoom * 100)}%)`);
    // nothing scrolls sideways when fitted
    expect(await stage.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.selectOption('#page-size-select', 'actual');
    expect(await grid.evaluate(el => (el as HTMLElement).style.zoom)).toBe('');
    await expect(page).not.toHaveURL(/size=fit/);
  });

  test('a wide window never scales a page up', async ({ page }) => {
    await page.setViewportSize({ width: 2400, height: 900 });
    await page.goto('/?view=page&size=fit');
    expect(Number(await page.locator('.lab-page-grid').evaluate(el => (el as HTMLElement).style.zoom))).toBe(1);
  });

  test('Compare has no size dropdown of its own in the top bar (it has its own Actual size)', async ({ page }) => {
    await page.goto('/?view=page&compare=v2');
    await expect(page.locator('#page-size-select')).toHaveCount(0);
  });
});
