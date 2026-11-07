import { test, expect, type Page } from '@playwright/test';

// A page version is a saved combination for one page: which version of each component plays in each
// slot, and the stagger. `home` ships v1 (the defaults) and v2 (card-2 lifts, delay.120).

const ENDPOINT = '**/__lab/page-version';

// Each component's start delay in a column (0-based), in page order.
const delays = (page: Page, column = 0) => page.evaluate(i => {
  const col = document.querySelectorAll('.lab-page-col')[i]!;
  return [...col.querySelectorAll<HTMLElement>('[data-component-id] [data-motion-target]')]
    .map(el => (el.getAnimations()[0]!.effect as KeyframeEffect).getTiming().delay as number);
}, column);

test.describe('Page versions', () => {
  test('lists the page\'s versions, v1 first, and starts on v1', async ({ page }) => {
    await page.goto('/?view=page&page=home');
    await expect(page.locator('#page-version-select option')).toHaveText([
      'v1: Default', 'v2: Second card lifts, slower stagger', 'v3: Plays on scroll',
    ]);
    await expect(page.locator('#page-version-select')).toHaveValue('v1');
    await expect(page.locator('#page-version-note')).toHaveText('');
    await expect(page.locator('.lab-nav__btn[data-view="pages"]')).toHaveAttribute('aria-current', 'page');
  });

  test('choosing a version loads its component versions and its stagger', async ({ page }) => {
    await page.goto('/?view=page&page=home');
    await page.selectOption('#page-version-select', 'v2');
    await expect(page).toHaveURL(/pv=v2/);
    await expect(page.locator('#motion-map-panel select').nth(0)).toHaveValue('v1');
    await expect(page.locator('#motion-map-panel select').nth(1)).toHaveValue('v2');
    await expect(page.locator('#stagger-select')).toHaveValue('120');
    await expect(page.locator('#page-version-note')).toHaveText('Forked from v1');
    expect(await delays(page)).toEqual([0, 120, 240]);
  });

  test('a version opens from its link, with nothing in the URL but the version', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v2');
    await expect(page.locator('#page-version-select')).toHaveValue('v2');
    await expect(page.locator('#motion-map-panel select').nth(1)).toHaveValue('v2');
    expect(page.url()).not.toContain('mm=');
  });

  test('an unknown version falls back to the first', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v9');
    await expect(page.locator('#page-version-select')).toHaveValue('v1');
  });

  test('changes are unsaved: flagged, kept in the URL, and gone once they match the saved version again', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v2');
    await page.selectOption('#motion-map-panel select >> nth=0', 'v2');
    await expect(page.locator('#page-version-note')).toHaveText('Unsaved changes. Save them as a new version to keep them.');
    await page.waitForFunction(() => window.location.search.includes('mm='));
    await page.goto(page.url());
    await expect(page.locator('#page-version-note')).toContainText('Unsaved changes');
    await expect(page.locator('#motion-map-panel select').nth(0)).toHaveValue('v2');
    await page.selectOption('#motion-map-panel select >> nth=0', 'v1');
    await expect(page.locator('#page-version-note')).toHaveText('Forked from v1');
    expect(page.url()).not.toContain('mm=');
  });

  test('changing the stagger is an unsaved change too, and choosing a version drops it', async ({ page }) => {
    await page.goto('/?view=page&page=home&pv=v2');
    await page.selectOption('#stagger-select', 'none');
    await expect(page).toHaveURL(/pageStagger=none/);
    await expect(page.locator('#page-version-note')).toContainText('Unsaved changes');
    await page.selectOption('#page-version-select', 'v1');
    await expect(page.locator('#page-version-note')).toHaveText('');
    expect(page.url()).not.toContain('pageStagger');
  });

  test('Compare plays two versions side by side, each with its own stagger', async ({ page }) => {
    await page.goto('/?view=page&page=home');
    await expect(page.locator('.lab-page-col')).toHaveCount(1);
    await page.selectOption('#page-compare-select', 'v2');
    await expect(page).toHaveURL(/compare=v2/);
    await expect(page.locator('.lab-page-col')).toHaveCount(2);
    await expect(page.locator('.lab-page-col__name')).toHaveText(['v1: Default', 'v2: Second card lifts, slower stagger']);
    await expect(page.locator('.lab-page-col .card')).toHaveCount(6);
    expect(await delays(page, 0)).toEqual([0, 80, 160]);
    expect(await delays(page, 1)).toEqual([0, 120, 240]);
    await page.click('#replay-all-btn');
    expect(await delays(page, 1)).toEqual([0, 120, 240]);
    await page.selectOption('#page-compare-select', '');
    await expect(page.locator('.lab-page-col')).toHaveCount(1);
    expect(page.url()).not.toContain('compare');
  });

  test('Compare offers the other versions and drops a comparison that becomes the open version', async ({ page }) => {
    await page.goto('/?view=page&page=home&compare=v2');
    await expect(page.locator('#page-compare-select option')).toHaveText(['None', 'v2: Second card lifts, slower stagger', 'v3: Plays on scroll']);
    await page.selectOption('#page-version-select', 'v2');
    await expect(page.locator('.lab-page-col')).toHaveCount(1);
    expect(page.url()).not.toContain('compare');
  });

  test('fitting a page to its column, and refitting on a resize, raises no page error', async ({ page }) => {
    // Refitting changes the column's height; doing it inside the ResizeObserver callback raises
    // "ResizeObserver loop completed with undelivered notifications" (seen in WebKit).
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto('/?view=page&page=home&compare=v2');
    await page.waitForLoadState('networkidle');
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.waitForTimeout(300);
    await page.setViewportSize({ width: 600, height: 900 });
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });

  test('one page is shown at its own size, never scaled, and scrolls sideways when the window is narrower', async ({ page }) => {
    // `home` has no width of its own, so it lays out at the default 400px; an imported page sets its Figma width.
    for (const width of [300, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/?view=page&page=home');
      const grid = page.locator('.lab-page-grid');
      expect(await grid.evaluate(el => (el as HTMLElement).style.zoom)).toBe('');
      expect((await grid.boundingBox())!.width).toBe(400);
      const stage = page.locator('#page-stage');
      expect(await stage.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(width === 300);
    }
    await expect(page.locator('.lab-page-col__scale')).toHaveCount(0);
    await expect(page.locator('#page-actual-size')).toHaveCount(0);
  });

  test('Compare fits the two pages to the window, says the scale, and never scales up', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto('/?view=page&page=home&compare=v2');
    const zooms = await page.locator('.lab-page-grid').evaluateAll(els => els.map(el => Number((el as HTMLElement).style.zoom)));
    expect(zooms).toHaveLength(2);
    for (const z of zooms) { expect(z).toBeGreaterThan(0); expect(z).toBeLessThan(1); }
    const labels = await page.locator('.lab-page-col__scale').allTextContents();
    expect(labels).toEqual(zooms.map(z => `${Math.round(z * 100)}%`));
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/?view=page&page=home&compare=v2');
    expect(await page.locator('.lab-page-grid').evaluateAll(els => els.map(el => (el as HTMLElement).style.zoom))).toEqual(['1', '1']);
    await expect(page.locator('.lab-page-col__scale')).toHaveText(['100%', '100%']);
  });

  test('"Actual size" shows both compared pages at their own size and scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto('/?view=page&page=home&compare=v2');
    await expect(page.locator('#page-actual-size')).not.toBeChecked();
    await page.check('#page-actual-size');
    await expect(page).toHaveURL(/size=actual/);
    for (const g of await page.locator('.lab-page-grid').all()) {
      expect(await g.evaluate(el => (el as HTMLElement).style.zoom)).toBe('');
      expect((await g.boundingBox())!.width).toBe(400);
    }
    await expect(page.locator('.lab-page-col__scale')).toHaveText(['100%', '100%']);
    expect(await page.locator('#page-stage').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.uncheck('#page-actual-size');
    expect(page.url()).not.toContain('size=');
    for (const z of await page.locator('.lab-page-grid').evaluateAll(els => els.map(el => Number((el as HTMLElement).style.zoom)))) expect(z).toBeLessThan(1);
  });

  test('the Actual size choice is dropped with the comparison', async ({ page }) => {
    await page.goto('/?view=page&page=home&compare=v2&size=actual');
    await expect(page.locator('#page-actual-size')).toBeChecked();
    await page.selectOption('#page-compare-select', '');
    expect(page.url()).not.toContain('size=');
  });
});

test.describe('Saving a page version', () => {
  test('sends the page, the name, what plays where and the stagger, then shows the new version', async ({ page }) => {
    let posted: Record<string, unknown> | null = null;
    await page.route(ENDPOINT, route => {
      const req = route.request();
      if (req.method() === 'GET') return route.fulfill({ json: { available: true } });
      posted = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>;
      return route.fulfill({ json: { id: 'v3' } });
    });
    await page.goto('/?view=page&page=home&pv=v2');
    await page.selectOption('#motion-map-panel select >> nth=2', 'v2');
    await page.selectOption('#stagger-select', 'none');
    page.once('dialog', d => d.accept('Both lift, no stagger'));
    await expect(page.locator('#save-page-version-btn')).toBeEnabled();
    await page.click('#save-page-version-btn');
    await expect(page.locator('#page-version-status')).toContainText('Saved as v3');
    expect(posted).toEqual({
      page: 'home',
      label: 'Both lift, no stagger',
      motionMap: { 'card-1': 'v1', 'card-2': 'v2', 'card-3': 'v2' },
      stagger: 'none',
      forkedFrom: 'v2',
    });
    await expect(page).toHaveURL(/pv=v3/);
    expect(page.url()).not.toContain('mm=');
  });

  test('saving the default stagger stores none of it', async ({ page }) => {
    let posted: Record<string, unknown> | null = null;
    await page.route(ENDPOINT, route => {
      const req = route.request();
      if (req.method() === 'GET') return route.fulfill({ json: { available: true } });
      posted = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>;
      return route.fulfill({ json: { id: 'v3' } });
    });
    await page.goto('/?view=page&page=home');
    page.once('dialog', d => d.accept('Same again'));
    await expect(page.locator('#save-page-version-btn')).toBeEnabled();
    await page.click('#save-page-version-btn');
    await expect(page.locator('#page-version-status')).toContainText('Saved as v3');
    expect(posted).not.toHaveProperty('stagger');
  });

  test('cancelling the name saves nothing', async ({ page }) => {
    let posts = 0;
    await page.route(ENDPOINT, route => {
      if (route.request().method() === 'POST') posts++;
      return route.fulfill({ json: { available: true, id: 'v3' } });
    });
    await page.goto('/?view=page&page=home');
    page.once('dialog', d => d.dismiss());
    await expect(page.locator('#save-page-version-btn')).toBeEnabled();
    await page.click('#save-page-version-btn');
    expect(posts).toBe(0);
  });

  test('a refused save says why and leaves the button usable', async ({ page }) => {
    await page.route(ENDPOINT, route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { available: true } });
      return route.fulfill({ status: 400, json: { error: 'Component "card" has no version "v9".' } });
    });
    await page.goto('/?view=page&page=home');
    page.once('dialog', d => d.accept('Broken'));
    await expect(page.locator('#save-page-version-btn')).toBeEnabled();
    await page.click('#save-page-version-btn');
    await expect(page.locator('#page-version-status')).toHaveText('Could not save: Component "card" has no version "v9".');
    await expect(page.locator('#save-page-version-btn')).toBeEnabled();
  });

  test('a built copy has no endpoint: the button is off and says to use the dev server', async ({ page }) => {
    await page.route(ENDPOINT, route => route.fulfill({ status: 404, body: 'Not found' }));
    await page.goto('/?view=page&page=home');
    await expect(page.locator('#save-page-version-btn')).toBeDisabled();
    await expect(page.locator('#page-version-status')).toContainText('Saving needs the dev server');
  });
});
