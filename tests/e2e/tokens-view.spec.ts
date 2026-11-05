import { test, expect } from '@playwright/test';
import { SAMPLES_PRESENT, SAMPLES_NEEDED } from '../samples.js';

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
      'expressive-standard', 'expressive-entrance', 'expressive-exit',
      'linear',
    ].map(n => `easing.${n}`));
  });

  test('a row is just the token name and its preview: no value, usage or status on the row', async ({ page }) => {
    await expect(page.locator('.lab-tokens-table th')).toHaveText(['Preview', 'Token']);
    await expect(page.locator('.lab-token-value, .lab-token-used-by, .lab-token-badge, .lab-token-desc')).toHaveCount(0);
    await expect(page.locator('.lab-token-row').first()).toHaveText('duration.100');
  });

  test('notes, status, value, usage and old names are in the tooltip', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    const tip = (key: string) => page.locator('.lab-token-row', { hasText: key }).first().getAttribute('title');
    const used = await tip('duration.220');
    expect(used).toContain('Status: system');
    expect(used).toContain('Value: 220ms');
    expect(used).toContain('Used by: card/v1');
    expect(await tip('duration.1200')).toContain('Not used yet');

    await open(page, 'Easing');
    const entrance = await tip('easing.expressive-entrance');
    expect(entrance).toContain('Status: system');
    expect(entrance).toContain('Value: cubic-bezier(0, 0, 0.3, 1)');
    await expect(page.locator('.lab-token-row', { hasText: 'expressive-settle' })).toHaveCount(0);
    await expect(page.locator('.lab-token-row', { hasText: 'expressive-bounce' })).toHaveCount(0);

    // Notes and status show for an experimental token too: the bounce tokens, under Motion.
    await page.click('#runtime-motion');
    await open(page, 'Bounce');
    const bounce = await tip('bounce.25');
    expect(bounce).toContain("Motion's default bounce");
    expect(bounce).toContain('Status: experimental');
    expect(bounce).toContain('Value: 0.25');
  });

  test('easings preview as curves; durations and distances as bars; the rest have no preview', async ({ page }) => {
    await expect(page.locator('.lab-token-row .lab-curve')).toHaveCount(0);
    await expect(page.locator('.lab-token-row .lab-token-preview')).toHaveCount(8);
    await open(page, 'Easing');
    await expect(page.locator('.lab-token-row .lab-curve')).toHaveCount(7);
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

  test('Bounce shows only under Motion: three tokens, each with a spring curve from Motion', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    await page.goto('/?view=tokens');
    await expect(page.locator('.lab-tokens-subtab', { hasText: 'Bounce' })).toHaveCount(0);
    await page.click('#runtime-motion');
    await open(page, 'Bounce');
    await expect(page.locator('.lab-token-name')).toHaveText(['bounce.0', 'bounce.25', 'bounce.50']);
    await expect(page.locator('#bounce-control')).toHaveValue('bounce.25');
    await expect(page.locator('.lab-tokens-table .lab-curve')).toHaveCount(3);
    const tip = (key: string) => page.locator('.lab-token-row', { hasText: key }).getAttribute('title');
    expect(await tip('bounce.25')).toContain('Used by: the global bounce setting');
    expect(await tip('bounce.50')).toContain('Used by: side-panel/v1');
    await page.click('#runtime-css');
    await expect(page.locator('.lab-tokens-subtab', { hasText: 'Bounce' })).toHaveCount(0);
  });

  test('the easing view is just easings: no bounce column, no Bounces table, no Easing / Spring switch', async ({ page }) => {
    await open(page, 'Easing');
    await expect(page.locator('.lab-tokens-table')).toHaveCount(1);
    await expect(page.locator('.lab-tokens-table th')).toHaveText(['Preview', 'Token']);
    await expect(page.locator('.lab-tokens-heading')).toHaveCount(0);
    await expect(page.locator('#easing-mode-spring')).toHaveCount(0);
    await expect(page.locator('.lab-tokens-subtab', { hasText: 'Bounce' })).toHaveCount(0);
  });
});
