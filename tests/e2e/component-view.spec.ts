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
