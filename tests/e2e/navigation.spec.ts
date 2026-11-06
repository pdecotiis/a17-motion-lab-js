import { test, expect } from '@playwright/test';
import { setRuntime } from './lab.js';

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
    await expect(page.locator('.lab-nav__btn[data-view="library"]')).toHaveAttribute('aria-current', 'page');
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
    await expect(page.locator('.lab-nav__btn[data-view="library"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.lab-nav__btn[aria-current="page"]')).toHaveCount(1);
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
    await expect.poll(() => style(page, '.lab-nav__btn[aria-current="page"]')).toMatchObject({ height: 40, radius: '8px', background: 'rgb(23, 23, 23)', color: 'rgb(245, 245, 245)' });
    const other = await style(page, '.lab-nav__btn:not([aria-current="page"])');
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

  test('the speed dropdown and the icon buttons are 40px, the kit\'s height, with 8px corners', async ({ page }) => {
    await page.goto('/?view=component');
    for (const selector of ['#speed-control', '#settings-btn', '#theme-toggle']) {
      expect((await style(page, selector)).height, selector).toBe(40);
    }
    expect((await style(page, '#speed-control')).radius).toBe('8px');
  });

  test('the motion library switch is in Settings, 40px, with the active half near-black', async ({ page }) => {
    await page.goto('/?view=component');
    await expect(page.locator('.lab-header .lab-segmented')).toHaveCount(0);
    await page.click('#settings-btn');
    expect((await style(page, '.lab-settings .lab-segmented')).height).toBe(40);
    await expect.poll(() => style(page, '.lab-segmented__btn[aria-pressed="true"]')).toMatchObject({ background: 'rgb(23, 23, 23)' });
  });

  test('in the dark theme the primary button is the light one', async ({ page }) => {
    await page.goto('/?view=tokens');
    await page.click('#theme-toggle');
    await expect.poll(() => style(page, '.lab-nav__btn[aria-current="page"]')).toMatchObject({ background: 'rgb(245, 245, 245)', color: 'rgb(23, 23, 23)' });
  });
});

// The nav is real links and a click switches the view in place: no page load.
test.describe('Navigation in place', () => {
  test('the nav items are links, and the current one is aria-current', async ({ page }) => {
    await page.goto('/?view=tokens');
    await expect(page.locator('a.lab-nav__btn')).toHaveCount(4);
    await expect(page.locator('a.lab-nav__btn[data-view="tokens"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('a.lab-nav__btn[data-view="library"]')).toHaveAttribute('href', '?view=library');
    await expect(page.locator('[aria-current="page"].lab-nav__btn')).toHaveCount(1);
  });

  test('a click changes the view without reloading the page', async ({ page }) => {
    await page.goto('/?view=library');
    await page.evaluate(() => { (window as unknown as { __kept: boolean }).__kept = true; });
    await page.click('a.lab-nav__btn[data-view="tokens"]');
    await expect(page).toHaveURL(/view=tokens/);
    await expect(page.locator('.lab-tokens-title')).toBeVisible();
    await page.click('a.lab-nav__btn[data-view="presets"]');
    await expect(page.locator('#presets-grid')).toBeVisible();
    // A reload would have thrown the marker away.
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
  });

  test('the back and forward buttons walk the views', async ({ page }) => {
    await page.goto('/?view=library');
    await page.click('a.lab-nav__btn[data-view="tokens"]');
    await page.click('a.lab-nav__btn[data-view="page"]');
    await expect(page.locator('.lab-page-layout')).toBeVisible();
    await page.goBack();
    await expect(page.locator('.lab-tokens-title')).toBeVisible();
    await expect(page.locator('a.lab-nav__btn[data-view="tokens"]')).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(page.locator('#library-grid')).toBeVisible();
    await page.goForward();
    await expect(page.locator('.lab-tokens-title')).toBeVisible();
  });

  test('a card, the breadcrumb and the logo are followed in place too', async ({ page }) => {
    await page.goto('/?view=library');
    await page.evaluate(() => { (window as unknown as { __kept: boolean }).__kept = true; });
    await page.locator('.lab-library-card').first().click();
    await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
    await page.click('#breadcrumb-library');
    await expect(page.locator('#library-grid')).toBeVisible();
    await page.locator('.lab-library-card').first().click();
    await page.click('.lab-header__brand');
    await expect(page.locator('#library-grid')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
  });

  test('a link opened with the command or control key keeps its browser behaviour (a new tab)', async ({ page, context }) => {
    await page.goto('/?view=library');
    const opened = context.waitForEvent('page');
    await page.click('a.lab-nav__btn[data-view="tokens"]', { modifiers: ['ControlOrMeta'] });
    const tab = await opened;
    await expect(tab).toHaveURL(/view=tokens/);
    await expect(page).toHaveURL(/view=library/);
  });

  test('a view left behind leaves nothing running: moving between the page view and the library many times is quiet', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('/?view=page');
    for (let i = 0; i < 4; i++) {
      await page.click('a.lab-nav__btn[data-view="library"]');
      await expect(page.locator('#library-grid')).toBeVisible();
      await page.click('a.lab-nav__btn[data-view="page"]');
      await expect(page.locator('.lab-page-layout')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

// Speed is a playback control: it sits above the example on the views that play one, not in the header or the side panel.
test.describe('Playback bar', () => {
  test('is above the example on the component view, and not in the header', async ({ page }) => {
    await page.goto('/?view=component');
    await expect(page.locator('.lab-header #speed-control')).toHaveCount(0);
    await expect(page.locator('.lab-sidebar #speed-control')).toHaveCount(0);
    const speed = (await page.locator('#speed-control').boundingBox())!;
    const preview = (await page.locator('#preview-primary').boundingBox())!;
    expect(speed.y + speed.height).toBeLessThanOrEqual(preview.y);
  });

  test('is above the page on the page view', async ({ page }) => {
    await page.goto('/?view=page');
    const speed = (await page.locator('#speed-control').boundingBox())!;
    const stage = (await page.locator('#page-stage').boundingBox())!;
    expect(speed.y + speed.height).toBeLessThanOrEqual(stage.y);
  });

  test('is only on the views that play an example', async ({ page }) => {
    for (const view of ['library', 'tokens', 'presets']) {
      await page.goto(`/?view=${view}`);
      await expect(page.locator('#speed-control')).toHaveCount(0);
    }
  });

  test('the speed holds as you move between views', async ({ page }) => {
    await page.goto('/?view=component');
    await page.selectOption('#speed-control', '0.5');
    await page.click('a.lab-nav__btn[data-view="page"]');
    await expect(page.locator('#speed-control')).toHaveValue('0.5');
  });

  test('says when the lab is playing with Motion, and the chip opens Settings', async ({ page }) => {
    await page.goto('/?view=component');
    await expect(page.locator('#runtime-chip')).toHaveCount(0);
    await setRuntime(page, 'motion');
    await expect(page.locator('#runtime-chip')).toHaveText('Playing with Motion (springs)');
    await page.click('#runtime-chip');
    await expect(page.locator('#settings-dialog')).toHaveAttribute('open', '');
    await expect(page.locator('#runtime-motion')).toHaveAttribute('aria-pressed', 'true');
  });
});

// The tab says what is on screen, and the header says the project when it has named itself (project.json). The template
// has no project.json, so these see the plain product name; the name itself is unit-tested (tests/unit/project.test.ts).
test.describe('Title and project name', () => {
  test('the header says Motion Lab and no project name when there is no project.json', async ({ page }) => {
    await page.goto('/?view=library');
    await expect(page.locator('.lab-header__logo')).toHaveText('Motion Lab');
    await expect(page.locator('#header-project')).toBeHidden();
  });

  test('the tab title says what is on screen, then the brand', async ({ page }) => {
    await page.goto('/?view=library');
    await expect(page).toHaveTitle(/^Library – .*Motion Lab$/);
    await page.click('a.lab-nav__btn[data-view="tokens"]');
    await expect(page).toHaveTitle(/^Tokens – .*Motion Lab$/);
    await page.click('a.lab-nav__btn[data-view="presets"]');
    await expect(page).toHaveTitle(/^Presets – .*Motion Lab$/);
    await page.click('a.lab-nav__btn[data-view="page"]');
    await expect(page).toHaveTitle(/^[^–]+ – .*Motion Lab$/);
  });

  test('a component names itself in the title, and the title follows the breadcrumb', async ({ page }) => {
    await page.goto('/?view=library');
    const name = (await page.locator('.lab-library-card').first().getAttribute('data-component'))!;
    await page.locator('.lab-library-card').first().click();
    await expect(page).toHaveTitle(new RegExp(`^${name} – .*Motion Lab$`));
    await page.click('#breadcrumb-library');
    await expect(page).toHaveTitle(/^Library – /);
  });
});
