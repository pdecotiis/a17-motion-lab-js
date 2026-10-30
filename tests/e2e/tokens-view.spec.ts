import { test, expect } from '@playwright/test';

test.describe('Tokens view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=tokens');
  });

  test('groups run transforms, duration, easing, springs, distance, and transforms open first', async ({ page }) => {
    await expect(page.locator('.lab-tokens-subtab')).toHaveText(['Transforms', 'Duration', 'Easing', 'Springs', 'Distance']);
    await expect(page.locator('.lab-tokens-subtab--active')).toHaveText('Transforms');
    await expect(page.locator('.lab-token-name').first()).toHaveText('transforms.entrance');
  });

  test('a transform shows its duration and easing as badges, not raw values', async ({ page }) => {
    const value = page.locator('.lab-token-row').first().locator('.lab-token-value');
    await expect(value.locator('.lab-token-badge')).toHaveText(['250ms', 'productive.entrance']);
    await expect(value).not.toContainText('cubic-bezier');
  });

  test('transforms, easings and springs preview as curves; durations and distances as bars', async ({ page }) => {
    const curves = page.locator('.lab-token-row .lab-curve');
    await expect(curves).toHaveCount(4);

    await page.click('.lab-tokens-subtab:has-text("Duration")');
    await expect(page.locator('.lab-token-row .lab-curve')).toHaveCount(0);
    await expect(page.locator('.lab-token-row .lab-token-preview')).toHaveCount(7);

    await page.click('.lab-tokens-subtab:has-text("Easing")');
    await expect(page.locator('.lab-token-row .lab-curve')).toHaveCount(6);

    await page.click('.lab-tokens-subtab:has-text("Springs")');
    await expect(page.locator('.lab-token-row .lab-curve')).toHaveCount(3);

    await page.click('.lab-tokens-subtab:has-text("Distance")');
    await expect(page.locator('.lab-token-row .lab-curve')).toHaveCount(0);
    await expect(page.locator('.lab-token-row .lab-token-preview')).toHaveCount(4);
  });

  test('a curve is a taller, rectangular graph with a path and a dot', async ({ page }) => {
    const curve = page.locator('.lab-token-row .lab-curve').first();
    const box = await curve.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(80);
    expect(box!.width).toBeGreaterThan(box!.height);
    await expect(curve.locator('.lab-curve__line')).toHaveAttribute('d', /^M/);
    await expect(curve.locator('.lab-curve__guide')).toHaveCount(2);
  });

  test('an overshooting spring draws above the 1 line', async ({ page }) => {
    await page.click('.lab-tokens-subtab:has-text("Springs")');
    const bouncy = page.locator('.lab-token-row').first().locator('.lab-curve');
    const top = await bouncy.locator('.lab-curve__line').evaluate(el => (el as unknown as SVGGraphicsElement).getBBox().y);
    const oneLine = await bouncy.locator('.lab-curve__guide').nth(1).getAttribute('y1');
    expect(top).toBeLessThan(Number(oneLine));
  });

  test('clicking a curve runs the dot along it', async ({ page }) => {
    const dot = page.locator('.lab-token-row .lab-curve').first().locator('.lab-curve__dot');
    const before = Number(await dot.getAttribute('cx'));
    await page.locator('.lab-token-row .lab-curve').first().click();
    await expect.poll(async () => Number(await dot.getAttribute('cx'))).toBeGreaterThan(before + 20);
  });
});
