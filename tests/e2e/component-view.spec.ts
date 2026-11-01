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

  const playedTiming = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('#preview-inner-primary [data-motion-target]')!;
      const timing = (el.getAnimations()[0]!.effect as KeyframeEffect).getTiming();
      return { duration: timing.duration as number, easing: timing.easing as string };
    });

  const EASINGS = [
    'productive-standard', 'productive-entrance', 'productive-exit',
    'expressive-standard', 'expressive-entrance', 'expressive-exit', 'expressive-settle', 'expressive-bounce',
    'linear',
  ];

  test('controls are two dropdowns, a duration and an easing from the system, and nothing finer', async ({ page }) => {
    await expect(page.locator('#ctrl-duration option')).toHaveText([
      'Version default · 220ms', '100ms', '140ms', '220ms', '300ms', '400ms', '560ms', '800ms', '1200ms',
    ]);
    await expect(page.locator('#ctrl-easing option')).toHaveText(['Version default · productive-entrance', ...EASINGS]);
    for (const id of ['ctrl-transform', 'ctrl-delay', 'ctrl-duration-custom', 'ctrl-easing-custom']) {
      await expect(page.locator(`#${id}`)).toHaveCount(0);
    }
  });

  test('picking a duration and an easing replays the version with them and says it is not saved', async ({ page }) => {
    expect(await playedTiming(page)).toEqual({ duration: 220, easing: 'cubic-bezier(0, 0, 0.38, 0.9)' });

    await page.selectOption('#ctrl-duration', 'duration.560');
    expect((await playedTiming(page)).duration).toBe(560);
    await expect(page.locator('#live-overrides')).toContainText('Previewing, not saved');
    await expect(page.locator('#live-overrides')).toContainText('duration: 560ms instead of 220ms');

    await page.selectOption('#ctrl-easing', 'easing.expressive-entrance');
    expect(await playedTiming(page)).toEqual({ duration: 560, easing: 'cubic-bezier(0, 0, 0.3, 1)' });
    await expect(page.locator('#live-overrides')).toContainText('easing: expressive-entrance instead of productive-entrance');

    await page.selectOption('#ctrl-duration', '');
    await page.selectOption('#ctrl-easing', '');
    await expect(page.locator('#live-overrides')).toBeEmpty();
    expect(await playedTiming(page)).toEqual({ duration: 220, easing: 'cubic-bezier(0, 0, 0.38, 0.9)' });
  });

  test('a spring version offers only the easings that have a spring form, and plays the pick as a spring', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(page.locator('#ctrl-duration option').first()).toHaveText('Version default · 300ms');
    await expect(page.locator('#ctrl-easing option')).toHaveText([
      'Version default · productive-entrance',
      'productive-standard', 'productive-entrance',
      'expressive-standard', 'expressive-entrance', 'expressive-settle', 'expressive-bounce',
    ]);
    const before = (await playedTiming(page)).duration;

    await page.selectOption('#ctrl-easing', 'easing.expressive-bounce');
    await expect(page.locator('#live-overrides')).toContainText('easing: expressive-bounce instead of productive-entrance');
    expect((await playedTiming(page)).duration).not.toBe(before);

    await page.selectOption('#ctrl-easing', '');
    await page.selectOption('#ctrl-duration', 'duration.140');
    expect((await playedTiming(page)).duration).toBeLessThan(before);
  });

  test('copy values button exists', async ({ page }) => {
    await expect(page.locator('#copy-values-btn')).toBeVisible();
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
    await expect(page.locator('#version-history li')).toHaveCount(3);
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
