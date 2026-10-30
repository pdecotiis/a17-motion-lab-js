import { test, expect } from '@playwright/test';

// card v2 is a spring whose token names motion.easings.spring-base as its CSS fallback.
test.describe('Tokens used follows the CSS / Spring engine', () => {
  const chips = (page: import('@playwright/test').Page) => page.locator('#tokens-used-list .lab-token-chip code');

  test('CSS mode lists the spring token and its fallback easing', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(chips(page)).toContainText(['motion.springs.bouncy', 'motion.easings.spring-base']);
  });

  test('Spring mode lists the spring token and no easing', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await page.click('#engine-spring');
    await expect(chips(page)).toHaveText(['motion.springs.bouncy']);
  });

  test('switching back to CSS brings the fallback easing back', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await page.click('#engine-spring');
    await page.click('#engine-css');
    await expect(chips(page)).toContainText(['motion.springs.bouncy', 'motion.easings.spring-base']);
  });

  test('easing is not pickable while the spring engine shapes it', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(page.locator('#ctrl-easing')).toBeEnabled();
    await page.click('#engine-spring');
    await expect(page.locator('#ctrl-easing')).toBeDisabled();
    await expect(page.locator('#ctrl-easing option').first()).toHaveText('Spring physics');
  });

  test('tween versions keep their duration and easing tokens in either mode', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.click('#engine-spring');
    await expect(chips(page)).toHaveText(['motion.timings.base', 'motion.easings.ease-out']);
    await expect(page.locator('#ctrl-easing')).toBeEnabled();
  });
});
