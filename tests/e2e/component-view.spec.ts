import { test, expect } from '@playwright/test';

test.describe('Component view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
  });

  test('renders the card component', async ({ page }) => {
    await expect(page.locator('.card')).toBeVisible();
  });

  test('switching version tabs changes version URL param', async ({ page }) => {
    await page.click('[data-version-id="v2"]');
    await expect(page).toHaveURL(/version=v2/);
  });

  test('replay button exists and is clickable', async ({ page }) => {
    const replayBtn = page.locator('#replay-btn');
    await expect(replayBtn).toBeVisible();
    await replayBtn.click();
  });

  const timingOf = (page: import('@playwright/test').Page, selector: string) =>
    page.evaluate((sel) => {
      const el = document.querySelector<HTMLElement>(sel)!;
      const anim = el.getAnimations()[0]!;
      const t = (anim.effect as KeyframeEffect).getTiming();
      return { duration: t.duration as number, delay: t.delay as number, rate: anim.playbackRate };
    }, selector);

  test('there are no controls: motion changes are new versions, not tweaks in the component view', async ({ page }) => {
    await expect(page.locator('[aria-label="Live controls"]')).toHaveCount(0);
    for (const id of ['ctrl-duration', 'ctrl-easing', 'ctrl-transform', 'copy-values-btn', 'live-overrides']) {
      await expect(page.locator(`#${id}`)).toHaveCount(0);
    }
  });

  test('a version with layers plays each layer on its element with its own timing', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v4');
    const inner = '#preview-inner-primary';
    expect(await timingOf(page, `${inner} [data-motion-target]`)).toMatchObject({ duration: 220, delay: 0 });
    expect(await timingOf(page, `${inner} [data-motion="title"]`)).toMatchObject({ duration: 300, delay: 70 });
    expect(await timingOf(page, `${inner} [data-motion="text"]`)).toMatchObject({ duration: 300, delay: 120 });
  });

  test('replay restarts the layers too, and the speed control reaches them', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v4');
    await page.selectOption('#speed-control', '0.25');
    expect((await timingOf(page, '#preview-inner-primary [data-motion="title"]')).rate).toBe(0.25);
    await page.click('#replay-btn');
    const restarted = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('#preview-inner-primary [data-motion="text"]')!;
      return { time: Number(el.getAnimations()[0]!.currentTime), rate: el.getAnimations()[0]!.playbackRate };
    });
    expect(restarted.rate).toBe(0.25);
    expect(restarted.time).toBeLessThan(200);
  });

  test('a version with no layers animates only its root', async ({ page }) => {
    const inside = await page.evaluate(() => document.querySelector('#preview-inner-primary [data-motion-target]')!.getAnimations({ subtree: true }).length);
    expect(inside).toBe(1);
  });

  test('compare select is present', async ({ page }) => {
    await expect(page.locator('#compare-select')).toBeVisible();
  });
});

test.describe('Version status and lineage', () => {
  test('archived versions are hidden by default and shown with the toggle', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await expect(page.locator('[data-version-id="v2"].lab-version-tab')).toBeVisible();
    await expect(page.locator('.lab-version-tab[data-version-id="v3"]')).toHaveCount(0);

    await page.check('#show-archived');
    await expect(page).toHaveURL(/archived=1/);
    await expect(page.locator('.lab-version-tab[data-version-id="v3"]')).toBeVisible();
  });

  test('shows status badges, lineage and version history', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(page.locator('.lab-version-tab[data-version-id="v2"] .lab-status-badge')).toHaveText('In progress');
    await expect(page.locator('#version-lineage')).toHaveText('Forked from v1: Fade Up');
    await expect(page.locator('#version-history li')).toHaveCount(4);
    await expect(page.locator('#version-history li[data-version-id="v3"] .lab-status-badge')).toHaveText('Archived');
  });

  test('shows when the version plays and what reduced-motion visitors get', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await expect(page.locator('#version-spec-meta')).toContainText('When scrolled into view (20% visible, first time only)');
    await expect(page.locator('#version-spec-meta')).toContainText('Fade only, no movement');

    await page.goto('/?view=component&component=card&version=v2');
    await expect(page.locator('#version-spec-meta')).toContainText('Trigger not specified');
  });

  test('generated CSS is named, token-based and carries a reduced-motion block', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    const css = page.locator('#css-pre');
    await expect(css).toContainText('@keyframes motion-card-v1');
    await expect(css).toContainText('var(--motion-duration-220, 220ms)');
    await expect(css).toContainText('translateY(var(--motion-distance-16, 16px))');
    await expect(css).toContainText('@media (prefers-reduced-motion: reduce)');
  });

  test('status filter narrows the version tabs', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.selectOption('#status-filter', 'archived');
    await expect(page).toHaveURL(/status=archived/);
    await expect(page.locator('.lab-version-tab[data-version-id="v3"]')).toBeVisible();
    await expect(page.locator('.lab-version-tab[data-version-id="v2"]')).toHaveCount(0);
  });

  test('an archived version opened by URL stays visible', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v3');
    await expect(page.locator('.lab-version-tab--active[data-version-id="v3"]')).toBeVisible();
  });
});

test.describe('Motion map status', () => {
  test('hides archived versions by default and shows them with the toggle', async ({ page }) => {
    await page.goto('/?view=page&page=home');
    const select = page.locator('#motion-map-panel select').first();
    await expect(select.locator('option[value="v3"]')).toHaveCount(0);
    await expect(select.locator('option[value="v2"]')).toHaveText(/\[In progress\]/);
    await expect(page.locator('#motion-map-panel .lab-status-badge').first()).toBeVisible();

    await page.check('#show-archived');
    await expect(select.locator('option[value="v3"]')).toHaveCount(1);
  });
});

test.describe('Sidebar accordions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
  });

  const accordions = (page: import('@playwright/test').Page) => page.locator('.lab-sidebar > details.lab-accordion');
  const summary = (page: import('@playwright/test').Page, title: string) => page.locator('.lab-sidebar > details > summary', { hasText: title });

  test('the panels are accordions, in the order Version, Tokens Used, Version history, Generated CSS', async ({ page }) => {
    await expect(accordions(page).locator('> summary')).toHaveText(['Version', 'Tokens Used', 'Version history', 'Generated CSS']);
  });

  test('Version and Tokens Used are open by default; Version history and Generated CSS are closed', async ({ page }) => {
    await expect(accordions(page).nth(0)).toHaveAttribute('open', '');
    await expect(accordions(page).nth(1)).toHaveAttribute('open', '');
    await expect(accordions(page).nth(2)).not.toHaveAttribute('open', '');
    await expect(accordions(page).nth(3)).not.toHaveAttribute('open', '');
    await expect(page.locator('#version-tabs')).toBeVisible();
    await expect(page.locator('#tokens-used-list')).toBeVisible();
    await expect(page.locator('#version-history')).toBeHidden();
    await expect(page.locator('#css-pre')).toBeHidden();
  });

  test('clicking a title opens and closes its panel', async ({ page }) => {
    await summary(page, 'Version history').click();
    await expect(page.locator('#version-history')).toBeVisible();
    await expect(page.locator('#version-history li')).toHaveCount(4);
    await summary(page, 'Version history').click();
    await expect(page.locator('#version-history')).toBeHidden();

    await summary(page, 'Generated CSS').click();
    await expect(page.locator('#css-pre')).toBeVisible();
    await expect(page.locator('#css-pre')).toContainText('@keyframes motion-card-v1');

    await summary(page, 'Tokens Used').click();
    await expect(page.locator('#tokens-used-list')).toBeHidden();
  });

  test('the title can be opened from the keyboard', async ({ page }) => {
    await summary(page, 'Generated CSS').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#css-pre')).toBeVisible();
  });

  test('Compare with stays a plain panel, always showing its select, after the accordions', async ({ page }) => {
    await expect(page.locator('.lab-sidebar > details')).toHaveCount(4);
    await expect(page.locator('.lab-sidebar > section')).toHaveCount(1);
    await expect(page.locator('.lab-sidebar > section')).toContainText('Compare with');
    await expect(page.locator('#compare-select')).toBeVisible();
    const last = await page.locator('.lab-sidebar > *').last().evaluate(el => el.tagName);
    expect(last).toBe('SECTION');
  });

  test('replay and the version tabs still work from the open Version panel', async ({ page }) => {
    await page.click('#replay-btn');
    await page.click('[data-version-id="v2"]');
    await expect(page).toHaveURL(/version=v2/);
  });
});

// The lab plays with CSS (WAAPI easing curves). It simulates no springs: a version authored as a spring
// plays its from/to values with its easing, and the header has no playback switch.
test.describe('Playback (CSS runtime)', () => {
  const ROOT = '#preview-inner-primary [data-motion-target]';
  const timing = (page: import('@playwright/test').Page, selector: string) =>
    page.evaluate((sel) => {
      const t = (document.querySelector<HTMLElement>(sel)!.getAnimations()[0]!.effect as KeyframeEffect).getTiming();
      return { duration: t.duration as number, easing: t.easing as string };
    }, selector);
  const playbackRow = (page: import('@playwright/test').Page) =>
    page.locator('#version-spec-meta dt:has-text("Playback") + dd');

  test('the header has no Easing / Spring switch', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await expect(page.locator('#play-easing')).toHaveCount(0);
    await expect(page.locator('#play-spring')).toHaveCount(0);
  });

  test('a tween plays its easing curve over its duration', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    expect(await timing(page, ROOT)).toEqual({ duration: 220, easing: 'cubic-bezier(0, 0, 0.38, 0.9)' });
    await expect(playbackRow(page)).toHaveText('Easing · productive-entrance, 220ms');
  });

  test('a version authored as a spring plays its easing, and says so', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    expect(await timing(page, ROOT)).toEqual({ duration: 300, easing: 'cubic-bezier(0, 0, 0.38, 0.9)' });
    await expect(playbackRow(page)).toHaveText('Easing · productive-entrance, 300ms (authored as a spring; CSS plays its easing)');
  });

  test('layers play their own easing, and the Playback row names each motion', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v4');
    for (const sel of [ROOT, '#preview-inner-primary [data-motion="title"]', '#preview-inner-primary [data-motion="text"]']) {
      expect((await timing(page, sel)).easing, sel).toMatch(/^cubic-bezier/);
    }
    await expect(playbackRow(page)).toHaveText([
      'Easing · productive-entrance, 220ms',
      'title: Easing · productive-entrance, 300ms',
      'text: Easing · productive-entrance, 300ms',
    ].join('\n'));
  });

  test('a stale ?play=spring link plays as easing', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1&play=spring');
    expect((await timing(page, ROOT)).easing).toMatch(/^cubic-bezier/);
  });

  test('the page view plays every component with its easing', async ({ page }) => {
    await page.goto('/?view=page&page=home');
    const easings = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-component-id] [data-motion-target]')]
        .map(el => (el.getAnimations()[0]!.effect as KeyframeEffect).getTiming().easing as string));
    expect(easings.length).toBeGreaterThan(0);
    expect(easings.every(e => e.startsWith('cubic-bezier'))).toBe(true);
  });
});

// The runtime switch: CSS (default) plays each version's easing curve; Motion (motion.dev) is a real
// animation library and the only runtime that plays a spring as one.
test.describe('Runtime (CSS / Motion)', () => {
  const ROOT = '#preview-inner-primary [data-motion-target]';
  const playbackRow = (page: import('@playwright/test').Page) =>
    page.locator('#version-spec-meta dt:has-text("Playback") + dd');
  const opacityOf = (page: import('@playwright/test').Page) =>
    page.evaluate((sel) => Number(getComputedStyle(document.querySelector<HTMLElement>(sel)!).opacity), ROOT);

  test('the header has a CSS / Motion switch, CSS by default', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await expect(page.locator('#runtime-css')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#runtime-motion')).toHaveAttribute('aria-pressed', 'false');
  });

  test('under Motion a tween plays its easing, a spring version plays as a real spring', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.click('#runtime-motion');
    await expect(page.locator('#runtime-motion')).toHaveAttribute('aria-pressed', 'true');
    await expect(playbackRow(page)).toHaveText('Easing · productive-entrance, 220ms');

    await page.goto('/?view=component&component=card&version=v2&runtime=motion');
    await expect(playbackRow(page)).toHaveText('Spring · bounce 0, 300ms');
    await page.click('#runtime-css');
    await expect(playbackRow(page)).toHaveText('Easing · productive-entrance, 300ms (authored as a spring; CSS plays its easing)');
  });

  test('Motion plays the motion: it starts away from the end state and arrives', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2&runtime=motion');
    await page.click('#replay-btn');
    await expect.poll(() => opacityOf(page), { timeout: 400 }).toBeLessThan(1);
    await expect.poll(() => opacityOf(page), { timeout: 3000 }).toBe(1);
  });

  test('the speed control reaches Motion too', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2&runtime=motion');
    await page.selectOption('#speed-control', '0.25');
    await page.click('#replay-btn');
    await page.waitForTimeout(600);
    expect(await opacityOf(page)).toBeLessThan(1);
  });

  test('the choice is in the URL, and leaves it again under CSS', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.click('#runtime-motion');
    await expect(page).toHaveURL(/runtime=motion/);
    await page.click('#runtime-css');
    await expect(page).not.toHaveURL(/runtime=/);
    const native = await page.evaluate((sel) => document.querySelector<HTMLElement>(sel)!.getAnimations().length, ROOT);
    expect(native).toBe(1);
  });

  test('it holds across the nav and across links between views', async ({ page }) => {
    await page.goto('/?view=library');
    await page.click('#runtime-motion');
    await page.locator('.lab-library-card').first().click();
    await expect(page).toHaveURL(/view=component/);
    await expect(page.locator('#runtime-motion')).toHaveAttribute('aria-pressed', 'true');
    await page.click('.lab-nav__btn[data-view="page"]');
    await expect(page).toHaveURL(/view=page/);
    await expect(page.locator('#runtime-motion')).toHaveAttribute('aria-pressed', 'true');
  });

  test('layers play under Motion too, and the Playback row names each motion', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v4&runtime=motion');
    await expect(playbackRow(page)).toHaveText([
      'Easing · productive-entrance, 220ms',
      'title: Easing · productive-entrance, 300ms',
      'text: Easing · productive-entrance, 300ms',
    ].join('\n'));
    await expect.poll(() => page.evaluate(() =>
      Number(getComputedStyle(document.querySelector<HTMLElement>('#preview-inner-primary [data-motion="text"]')!).opacity)), { timeout: 3000 }).toBe(1);
  });

  test('exports are as authored whatever the runtime: the CSS is the same', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.locator('.lab-sidebar > details > summary', { hasText: 'Generated CSS' }).click();
    const before = await page.locator('#css-pre').textContent();
    await page.goto('/?view=component&component=card&version=v1&runtime=motion');
    await page.locator('.lab-sidebar > details > summary', { hasText: 'Generated CSS' }).click();
    expect(await page.locator('#css-pre').textContent()).toBe(before);
  });

  test('a Motion version with no console errors in the library and page views', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    for (const url of ['/?view=library&runtime=motion', '/?view=page&page=home&runtime=motion']) {
      await page.goto(url);
      await page.waitForTimeout(500);
    }
    expect(errors).toEqual([]);
  });
});
