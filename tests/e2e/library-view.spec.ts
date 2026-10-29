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
    await expect(page.locator('.lab-nav__btn[data-view="library"]')).toHaveAttribute('aria-pressed', 'true');
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
