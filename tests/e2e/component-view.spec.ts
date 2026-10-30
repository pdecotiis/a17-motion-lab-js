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

  const playedDuration = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('#preview-inner-primary [data-motion-target]')!;
      return (el.getAnimations()[0]!.effect as KeyframeEffect).getTiming().duration;
    });

  test('controls are a dropdown of transforms, with no granular duration, easing or delay fields', async ({ page }) => {
    await expect(page.locator('#ctrl-title')).toHaveText('Transform');
    await expect(page.locator('select#ctrl-transform')).toBeVisible();
    await expect(page.locator('#ctrl-transform option')).toHaveText([
      'Version default · entrance', 'entrance', 'exit', 'standard', 'emphasized',
    ]);
    await expect(page.locator('#ctrl-transform-detail')).toHaveText('entrance · 250ms · productive.entrance');
    for (const id of ['ctrl-duration', 'ctrl-easing', 'ctrl-delay', 'ctrl-duration-custom']) {
      await expect(page.locator(`#${id}`)).toHaveCount(0);
    }
    await expect(page.locator('.lab-option-btn')).toHaveCount(0);
  });

  test('picking a transform replays the version with it and says it is not saved', async ({ page }) => {
    expect(await playedDuration(page)).toBe(250);

    await page.selectOption('#ctrl-transform', 'transforms.emphasized');
    await expect(page.locator('#ctrl-transform')).toHaveValue('transforms.emphasized');
    await expect(page.locator('#ctrl-transform-detail')).toHaveText('400ms · expressive.entrance');
    await expect(page.locator('#live-overrides')).toContainText('Previewing, not saved');
    await expect(page.locator('#live-overrides')).toContainText('emphasized (400ms · expressive.entrance) instead of entrance · 250ms · productive.entrance');
    expect(await playedDuration(page)).toBe(400);

    await page.selectOption('#ctrl-transform', 'transforms.exit');
    expect(await playedDuration(page)).toBe(150);

    await page.selectOption('#ctrl-transform', '');
    await expect(page.locator('#live-overrides')).toBeEmpty();
    expect(await playedDuration(page)).toBe(250);
  });

  test('a spring version picks between spring tokens instead', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(page.locator('#ctrl-title')).toHaveText('Spring');
    await expect(page.locator('#ctrl-transform option')).toHaveText(['Version default · bouncy', 'bouncy', 'gentle', 'stiff']);
    await expect(page.locator('#ctrl-transform-detail')).toHaveText('bouncy · bounce 0.4 · 600ms');

    await page.selectOption('#ctrl-transform', 'springs.gentle');
    await expect(page.locator('#ctrl-transform-detail')).toHaveText('bounce 0.1 · 400ms');
    await expect(page.locator('#live-overrides')).toContainText('gentle (bounce 0.1 · 400ms) instead of bouncy');
    expect(await playedDuration(page)).toBe(400);
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
    await expect(css).toContainText('var(--motion-duration-250, 250ms)');
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
