import { test, expect } from '@playwright/test';

test.describe('Library view', () => {
  test('shows a card for every registered component', async ({ page }) => {
    await page.goto('/?view=library');
    const cards = page.locator('.lab-library-card');
    await expect(cards.first()).toBeVisible();
    await expect(page.locator('#library-count')).toHaveText(new RegExp(`^${await cards.count()} component`));
  });

  test('each card previews the component', async ({ page }) => {
    await page.goto('/?view=library');
    const count = await page.locator('.lab-library-card').count();
    await expect(page.locator('.lab-library-card [data-motion-target]')).toHaveCount(count);
  });

  test('Library tab is active', async ({ page }) => {
    await page.goto('/?view=library');
    await expect(page.locator('.lab-nav__btn[data-view="library"]')).toHaveAttribute('aria-current', 'page');
  });

  test('clicking a card opens it in the component view', async ({ page }) => {
    await page.goto('/?view=library');
    const first = page.locator('.lab-library-card').first();
    const name = await first.getAttribute('data-component');
    await first.click();
    await expect(page).toHaveURL(new RegExp(`view=component&component=${name}`));
    await expect(page.locator('[data-motion-target]').first()).toBeVisible();
  });

  test('hovering a card plays its animation', async ({ page }) => {
    await page.goto('/?view=library');
    const card = page.locator('.lab-library-card').first();
    await card.hover();
    const playing = await card.evaluate(el =>
      [...el.querySelectorAll('[data-motion-target]')].some(t => t.getAnimations().length > 0));
    expect(playing).toBe(true);
  });

  test('search filters the grid and shows an empty state', async ({ page }) => {
    await page.goto('/?view=library');
    await page.fill('#library-search', 'zzz-no-such-component');
    await expect(page.locator('.lab-library-card')).toHaveCount(0);
    await expect(page.getByText('No components match.')).toBeVisible();
    await page.waitForFunction(() => window.location.search.includes('q=zzz'));
  });

  test('search restores from the URL', async ({ page }) => {
    await page.goto('/?view=library&q=zzz-no-such-component');
    await expect(page.locator('#library-search')).toHaveValue('zzz-no-such-component');
    await expect(page.locator('.lab-library-card')).toHaveCount(0);
  });

  test('loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=library');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });
});

// The toolbar above the cards: search and the status dropdown together on the left; the count and Show archived on the right.
test.describe('Library toolbar', () => {
  const box = async (page: import('@playwright/test').Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

  test('the search and the status dropdown sit together, side by side', async ({ page }) => {
    await page.goto('/?view=library');
    const search = await box(page, '#library-search');
    const status = await box(page, '#status-filter');
    expect(Math.abs(search.y - status.y)).toBeLessThanOrEqual(1);
    expect(status.x - (search.x + search.width)).toBeLessThanOrEqual(16);
    expect(status.x).toBeGreaterThan(search.x);
  });

  test('the count and Show archived are on the right, the count first', async ({ page }) => {
    await page.goto('/?view=library');
    const status = await box(page, '#status-filter');
    const count = await box(page, '#library-count');
    const archived = await box(page, 'label.lab-check');
    const main = await box(page, '#main-content');
    expect(count.x).toBeGreaterThan(status.x + status.width);
    expect(archived.x).toBeGreaterThan(count.x);
    expect(archived.x + archived.width).toBeGreaterThan(main.x + main.width - 40);
    expect(Math.abs(count.y + count.height / 2 - (archived.y + archived.height / 2))).toBeLessThanOrEqual(2);
  });

  test('the count and the Show archived label are 16px, like the lab\'s other labels', async ({ page }) => {
    await page.goto('/?view=library');
    const size = (selector: string) => page.locator(selector).first().evaluate(el => getComputedStyle(el).fontSize);
    expect(await size('#library-count')).toBe('16px');
    expect(await size('label.lab-check')).toBe('16px');
  });

  test('Show archived still works from its new place', async ({ page }) => {
    await page.goto('/?view=library');
    await page.check('#show-archived');
    await expect(page).toHaveURL(/archived=1/);
    await page.uncheck('#show-archived');
    await expect(page).not.toHaveURL(/archived=1/);
  });
});
