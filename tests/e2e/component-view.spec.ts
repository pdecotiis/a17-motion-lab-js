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

  test('duration, easing and delay are dropdowns of tokens plus Custom…', async ({ page }) => {
    const labels = (id: string) => page.locator(`#${id} option`).allTextContents();

    const duration = await labels('ctrl-duration');
    expect(duration[0]).toMatch(/^Version default/);
    expect(duration).toContain('base · 300ms');
    expect(duration.at(-1)).toBe('Custom…');

    const easing = await labels('ctrl-easing');
    expect(easing).toContain('ease-out · cubic-bezier(0, 0, 0.2, 1)');
    expect(easing).not.toContain('linear');
    expect(easing.at(-1)).toBe('Custom…');

    const delay = await labels('ctrl-delay');
    expect(delay).toContain('none · 0ms');
    expect(delay.at(-1)).toBe('Custom…');
  });

  test('there is no free-form value field until Custom… is chosen', async ({ page }) => {
    for (const id of ['ctrl-duration-custom', 'ctrl-easing-custom', 'ctrl-delay-custom']) {
      await expect(page.locator(`#${id}`)).toBeHidden();
    }
    await page.selectOption('#ctrl-duration', 'motion.timings.slow');
    await expect(page.locator('#ctrl-duration-custom')).toBeHidden();
    await page.selectOption('#ctrl-duration', '__custom__');
    await expect(page.locator('#ctrl-duration-custom')).toBeVisible();
    await page.selectOption('#ctrl-easing', '__custom__');
    await expect(page.locator('#ctrl-easing-custom')).toBeVisible();
    await page.selectOption('#ctrl-delay', '__custom__');
    await expect(page.locator('#ctrl-delay-custom')).toBeVisible();
  });

  test('picking a token overrides the version and a custom value is flagged', async ({ page }) => {
    await page.selectOption('#ctrl-duration', 'motion.timings.slower');
    await expect(page.locator('#live-overrides')).toContainText('duration: 300ms → 800ms');
    await expect(page.locator('#live-overrides')).not.toContainText('custom');

    await page.selectOption('#ctrl-duration', '__custom__');
    await page.fill('#ctrl-duration-custom', '425');
    await page.dispatchEvent('#ctrl-duration-custom', 'change');
    await expect(page.locator('#live-overrides')).toContainText('duration: 300ms → 425ms (custom, not a token)');

    await page.selectOption('#ctrl-duration', '');
    await expect(page.locator('#live-overrides')).toBeEmpty();
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
