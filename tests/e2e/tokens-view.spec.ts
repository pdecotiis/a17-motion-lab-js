import { test, expect } from '@playwright/test';

test.describe('Tokens view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=tokens');
  });

  const names = (page: import('@playwright/test').Page) => page.locator('.lab-token-name').allTextContents();
  const open = (page: import('@playwright/test').Page, kind: string) => page.click(`.lab-tokens-subtab:has-text("${kind}")`);

  test('the kinds are duration, easing, distance, scale, opacity and delay; duration opens first', async ({ page }) => {
    await expect(page.locator('.lab-tokens-subtab')).toHaveText(['Duration', 'Easing', 'Distance', 'Scale', 'Opacity', 'Delay']);
    await expect(page.locator('.lab-tokens-subtab--active')).toHaveText('Duration');
  });

  test('tokens run smallest to largest within each kind', async ({ page }) => {
    expect(await names(page)).toEqual(['100', '140', '220', '300', '400', '560', '800', '1200'].map(n => `duration.${n}`));
    await open(page, 'Distance');
    expect(await names(page)).toEqual(['4', '8', '12', '16', '24', '32', '40', '48'].map(n => `distance.${n}`));
    await open(page, 'Scale');
    expect(await names(page)).toEqual(['60', '75', '90', '95', '96', '97', '98', '99', '103', '106'].map(n => `scale.${n}`));
    await open(page, 'Opacity');
    expect(await names(page)).toEqual(['04', '08', '10', '56'].map(n => `opacity.${n}`));
    await open(page, 'Delay');
    expect(await names(page)).toEqual(['40', '70', '120'].map(n => `delay.${n}`));
  });

  test('easings run in system order', async ({ page }) => {
    await open(page, 'Easing');
    expect(await names(page)).toEqual([
      'productive-standard', 'productive-entrance', 'productive-exit',
      'expressive-standard', 'expressive-entrance', 'expressive-exit', 'expressive-settle', 'expressive-bounce',
      'linear',
    ].map(n => `easing.${n}`));
  });

  test('a row is just the token name and its preview: no value, usage or status on the row', async ({ page }) => {
    await expect(page.locator('.lab-tokens-table th')).toHaveText(['Preview', 'Token']);
    await expect(page.locator('.lab-token-value, .lab-token-used-by, .lab-token-badge, .lab-token-desc')).toHaveCount(0);
    await expect(page.locator('.lab-token-row').first()).toHaveText('duration.100');
  });

  test('notes, status, value, usage and old names are in the tooltip', async ({ page }) => {
    const tip = (key: string) => page.locator('.lab-token-row', { hasText: key }).first().getAttribute('title');
    const used = await tip('duration.220');
    expect(used).toContain('Status: system');
    expect(used).toContain('Value: 220ms');
    expect(used).toContain('Used by: card/v1');
    expect(await tip('duration.1200')).toContain('Not used yet');

    await open(page, 'Easing');
    const settle = await tip('easing.expressive-settle');
    expect(settle).toContain('Placeholder curve');
    expect(settle).toContain('Status: experimental');
    expect(settle).toContain('Value: cubic-bezier(0.34, 1.06, 0.64, 1)');
  });

  test('easings preview as curves; durations and distances as bars; the rest have no preview', async ({ page }) => {
    await expect(page.locator('.lab-token-row .lab-curve')).toHaveCount(0);
    await expect(page.locator('.lab-token-row .lab-token-preview')).toHaveCount(8);
    await open(page, 'Easing');
    await expect(page.locator('.lab-token-row .lab-curve')).toHaveCount(9);
    await open(page, 'Distance');
    await expect(page.locator('.lab-token-row .lab-token-preview')).toHaveCount(8);
    await open(page, 'Scale');
    await expect(page.locator('.lab-token-row .lab-curve, .lab-token-row .lab-token-preview')).toHaveCount(0);
  });

  test('a curve is a taller, rectangular graph with a path and a dot', async ({ page }) => {
    await open(page, 'Easing');
    const curve = page.locator('.lab-token-row .lab-curve').first();
    const box = await curve.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(80);
    expect(box!.width).toBeGreaterThan(box!.height);
    await expect(curve.locator('.lab-curve__line')).toHaveAttribute('d', /^M/);
    await expect(curve.locator('.lab-curve__guide')).toHaveCount(2);
  });

  test('clicking a curve runs the dot along it', async ({ page }) => {
    await open(page, 'Easing');
    const dot = page.locator('.lab-token-row .lab-curve').first().locator('.lab-curve__dot');
    const before = Number(await dot.getAttribute('cx'));
    await page.locator('.lab-token-row .lab-curve').first().click();
    await expect.poll(async () => Number(await dot.getAttribute('cx'))).toBeGreaterThan(before + 20);
  });

  test('the easing view plays as Easing by default and has an Easing / Spring switch', async ({ page }) => {
    await expect(page.locator('#easing-mode-easing')).toHaveCount(0);
    await open(page, 'Easing');
    await expect(page.locator('#easing-mode-easing')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#easing-mode-spring')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.lab-tokens-table th')).toHaveText(['Preview', 'Token']);
    await expect(page.locator('.lab-tokens-heading')).toHaveCount(0);
  });

  test('Spring shows each easing\'s bounce step, a spring curve, and a Bounces table', async ({ page }) => {
    await open(page, 'Easing');
    const before = await page.locator('.lab-token-row').first().locator('.lab-curve__line').getAttribute('d');
    const easingNames = await names(page);

    await page.click('#easing-mode-spring');
    await expect(page.locator('#easing-mode-spring')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.lab-tokens-table').first().locator('th')).toHaveText(['Preview', 'Token', 'Bounce']);
    expect((await names(page)).slice(0, 9)).toEqual(easingNames);

    const bounceCell = (i: number) => page.locator('.lab-tokens-table').first().locator('.lab-token-row').nth(i).locator('td').nth(2);
    const steps = ['bounce-0', 'bounce-0', 'no spring', 'bounce-0', 'bounce-0', 'no spring', 'bounce-10', 'bounce-25', 'no spring'];
    for (const [i, step] of steps.entries()) await expect(bounceCell(i)).toHaveText(step);

    // a spring curve for the six with a spring form; none for the two exits and linear
    await expect(page.locator('.lab-tokens-table').first().locator('.lab-curve')).toHaveCount(6);
    expect(await page.locator('.lab-token-row').first().locator('.lab-curve__line').getAttribute('d')).not.toBe(before);

    await expect(page.locator('.lab-tokens-heading')).toHaveText('Bounces');
    const bounces = page.locator('.lab-tokens-table').nth(1);
    await expect(bounces.locator('.lab-token-name')).toHaveText(['bounce.0', 'bounce.10', 'bounce.25']);
    await expect(bounces.locator('.lab-curve')).toHaveCount(3);

    await page.click('#easing-mode-easing');
    await expect(page.locator('.lab-tokens-heading')).toHaveCount(0);
    await expect(page.locator('.lab-tokens-table th')).toHaveText(['Preview', 'Token']);
  });

  test('bounce-0 is never listed as a dependency; other bounces list the easings that use them', async ({ page }) => {
    await open(page, 'Easing');
    await page.click('#easing-mode-spring');
    const tip = (key: string) => page.locator('.lab-tokens-table').nth(1).locator('.lab-token-row', { hasText: key }).getAttribute('title');
    expect(await tip('bounce.0')).toContain('Not used yet');
    expect(await tip('bounce.10')).toContain('Used by: easing.expressive-settle (spring)');
    expect(await tip('bounce.25')).toContain('Used by: easing.expressive-bounce (spring)');
  });
});
