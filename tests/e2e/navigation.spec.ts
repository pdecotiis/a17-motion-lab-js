import { test, expect } from '@playwright/test';

// The top navigation: the Library is home and the way into a component, there is no Component item, and a component
// has a breadcrumb back. Runs on the lab's own components, so it holds in a project as well as in the template.
test.describe('Navigation', () => {
  test('the items are Library, Page, Tokens and Presets: there is no Component item', async ({ page }) => {
    await page.goto('/?view=library');
    await expect(page.locator('.lab-nav__btn')).toHaveText(['Library', 'Page', 'Tokens', 'Presets']);
    await expect(page.locator('.lab-nav__btn[data-view="component"]')).toHaveCount(0);
  });

  test('the Library is home: opening the lab with no view shows it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#library-grid')).toBeVisible();
    await expect(page.locator('.lab-nav__btn[data-view="library"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the logo goes home to the Library', async ({ page }) => {
    await page.goto('/?view=tokens');
    await page.click('.lab-header__brand');
    await expect(page).toHaveURL(/view=library/);
    await expect(page.locator('#library-grid')).toBeVisible();
  });

  test('a component opens from the Library, and the Library stays the lit item', async ({ page }) => {
    await page.goto('/?view=library');
    await page.locator('.lab-library-card').first().click();
    await expect(page).toHaveURL(/view=component/);
    await expect(page.locator('.lab-nav__btn[data-view="library"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.lab-nav__btn[aria-pressed="true"]')).toHaveCount(1);
  });

  test.describe('the breadcrumb', () => {
    test('says Library / <component>, and the current page is not a link', async ({ page }) => {
      await page.goto('/?view=library');
      const name = await page.locator('.lab-library-card').first().getAttribute('data-component');
      await page.locator('.lab-library-card').first().click();
      const crumb = page.locator('nav[aria-label="Breadcrumb"]');
      await expect(crumb.locator('li')).toHaveText(['Library', name!]);
      await expect(crumb.locator('a')).toHaveCount(1);
      await expect(crumb.locator('[aria-current="page"]')).toHaveText(name!);
    });

    test('is on the component view and nowhere else', async ({ page }) => {
      await page.goto('/?view=component');
      await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
      for (const view of ['library', 'page', 'tokens', 'presets']) {
        await page.goto(`/?view=${view}`);
        await expect(page.locator('nav[aria-label="Breadcrumb"]')).toHaveCount(0);
      }
    });

    test('goes back to the Library', async ({ page }) => {
      await page.goto('/?view=component');
      await page.click('#breadcrumb-library');
      await expect(page).toHaveURL(/view=library/);
      await expect(page.locator('#library-grid')).toBeVisible();
    });

    test('returns to the Library the way it was left: the search stays', async ({ page }) => {
      await page.goto('/?view=library');
      const first = page.locator('.lab-library-card').first();
      const name = (await first.getAttribute('data-component'))!;
      await page.fill('#library-search', name);
      await page.locator('.lab-library-card').first().click();
      await expect(page).toHaveURL(/view=component/);
      await page.click('#breadcrumb-library');
      await expect(page).toHaveURL(new RegExp(`view=library.*q=${name}|q=${name}.*view=library`));
      await expect(page.locator('#library-search')).toHaveValue(name);
    });

    test('keeps nothing else from the Library URL in the link', async ({ page }) => {
      await page.goto('/?view=component');
      const href = await page.locator('#breadcrumb-library').getAttribute('href');
      expect(href).toBe('?view=library');
    });
  });
});

// The header's controls are the Vitrine kit's button: 40px high, 8px corners, the near-black one for the page you are
// on and a quiet tint for the rest, a shade lighter on hover.
test.describe('Header controls look like the kit\'s buttons', () => {
  const style = (page: import('@playwright/test').Page, selector: string) => page.locator(selector).first().evaluate(el => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { height: Math.round(r.height), radius: s.borderTopLeftRadius, background: s.backgroundColor, color: s.color };
  });

  test('nav items are 40px with 8px corners; the current one is near-black with light text', async ({ page }) => {
    await page.goto('/?view=tokens');
    // (the colours ease in for 120ms, so poll)
    await expect.poll(() => style(page, '.lab-nav__btn[aria-pressed="true"]')).toMatchObject({ height: 40, radius: '8px', background: 'rgb(23, 23, 23)', color: 'rgb(245, 245, 245)' });
    const other = await style(page, '.lab-nav__btn[aria-pressed="false"]');
    expect(other.height).toBe(40);
    expect(other.background).toBe('rgba(0, 0, 0, 0)');
  });

  test('the primary hover and pressed shades are the kit\'s: #282828 and #3e3e3e', async ({ page }) => {
    await page.goto('/?view=component');
    const replay = page.locator('#replay-btn');
    await replay.hover();
    await expect.poll(() => replay.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(40, 40, 40)');
    await page.mouse.down();
    await expect.poll(() => replay.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(62, 62, 62)');
    await page.mouse.up();
  });

  test('the runtime toggle, the speed dropdown and the icon buttons are 40px, the kit\'s height', async ({ page }) => {
    await page.goto('/?view=component');
    for (const selector of ['.lab-segmented', '#speed-control', '#settings-btn', '#theme-toggle']) {
      expect((await style(page, selector)).height, selector).toBe(40);
    }
    expect((await style(page, '#speed-control')).radius).toBe('8px');
    expect((await style(page, '.lab-segmented__btn[aria-pressed="true"]')).background).toBe('rgb(23, 23, 23)');
  });

  test('in the dark theme the primary button is the light one', async ({ page }) => {
    await page.goto('/?view=tokens');
    await page.click('#theme-toggle');
    await expect.poll(async () => (await style(page, '.lab-nav__btn[aria-pressed="true"]')).background).toBe('rgb(245, 245, 245)');
    expect((await style(page, '.lab-nav__btn[aria-pressed="true"]')).color).toBe('rgb(23, 23, 23)');
  });
});
