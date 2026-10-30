import { test, expect } from '@playwright/test';

// card v2 is a spring. The seed tokens give it no fallback easing, so both engines list just its spring token.
test.describe('Tokens used follows the CSS / Spring engine', () => {
  const chips = (page: import('@playwright/test').Page) => page.locator('#tokens-used-list .lab-token-chip code');

  test('CSS mode lists the spring token', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(chips(page)).toHaveText(['springs.bouncy']);
  });

  test('Spring mode lists the spring token and no easing', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await page.click('#engine-spring');
    await expect(chips(page)).toHaveText(['springs.bouncy']);
  });

  test('switching back to CSS still lists the spring token', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await page.click('#engine-spring');
    await page.click('#engine-css');
    await expect(chips(page)).toHaveText(['springs.bouncy']);
  });

  test('a spring offers the same spring tokens in either engine, and no easing', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    const options = page.locator('#ctrl-transform option');
    await expect(options).toHaveText(['Version default · bouncy', 'bouncy', 'gentle', 'stiff']);
    await page.click('#engine-spring');
    await expect(options).toHaveText(['Version default · bouncy', 'bouncy', 'gentle', 'stiff']);
    await expect(page.locator('#ctrl-easing')).toHaveCount(0);
  });

  test('tween versions keep their duration and easing tokens in either mode', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.click('#engine-spring');
    await expect(chips(page)).toHaveText(['transforms.entrance', 'duration.250', 'easing.productive.entrance']);
    await expect(page.locator('#ctrl-transform option')).toHaveCount(5);
  });
});
