import { test, expect } from '@playwright/test';

// "Tokens used" lists what a version uses: its duration, easing and delay, a stagger that is a token,
// the tokens its keyframes name, and for a spring the bounce token of its easing (bounce-0 is never
// listed). Springs always play as real springs: there is no engine toggle.
test.describe('Tokens used', () => {
  const chips = (page: import('@playwright/test').Page) => page.locator('#tokens-used-list .lab-token-chip code');

  test('a tween lists its duration, easing, stagger and the distance its keyframes name', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await expect(chips(page)).toHaveText(['duration.220', 'easing.productive-entrance', 'delay.70', 'distance.16']);
  });

  test('a spring lists its duration and easing; bounce-0 is not listed', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(chips(page)).toHaveText(['duration.300', 'easing.productive-entrance', 'delay.120']);
  });

  test('a version that follows the pairing rules shows no pairing warning', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await expect(page.locator('#tokens-used-list')).not.toContainText('Pairing');
  });

  test('there is no CSS / Spring engine toggle', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(page.locator('#engine-css')).toHaveCount(0);
    await expect(page.locator('#engine-spring')).toHaveCount(0);
  });

  test('the generated CSS for a spring is one linear() curve, with no fallback', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    const css = page.locator('#css-pre');
    await expect(css).toContainText('linear(0,');
    await expect(css).toContainText('/* spring of easing.productive-entrance: bounce 0, 366ms (300ms / 0.82) */');
    await expect(css).not.toContainText('@supports');
    await expect(css).not.toContainText('cubic-bezier');
  });
});
