import { test, expect } from '@playwright/test';

// "Tokens used" lists what each motion of a version uses, and where in the motion each token sits:
// its duration, easing and delay, a stagger that is a token, the tokens its keyframes name, and for a
// version authored as a spring lists its duration and easing (CSS plays no spring, so no bounce). A version with layers (the text
// moving differently from the card) gets a group for the root and one for each layer.
test.describe('Tokens used', () => {
  const chips = (page: import('@playwright/test').Page) => page.locator('#tokens-used-list .lab-token-chip code');
  const wheres = (page: import('@playwright/test').Page) => page.locator('#tokens-used-list .lab-token-chip-where');

  test('a tween lists its duration, easing, stagger and the distance its keyframes name, and where each sits', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await expect(chips(page)).toHaveText(['duration.220', 'easing.productive-entrance', 'delay.70', 'distance.16']);
    await expect(wheres(page)).toHaveText(['duration', 'easing', 'stagger', '0% transform']);
    await expect(page.locator('.lab-tokens-layer')).toHaveCount(0);
  });

  test('a spring lists its duration and easing, with no bounce token', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(chips(page)).toHaveText(['duration.300', 'easing.productive-entrance', 'delay.120']);
    await expect(wheres(page)).toHaveText(['duration', 'easing', 'stagger']);
  });

  test('under Motion no motion lists an easing: everything is a spring, from its duration', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2&runtime=motion');
    await expect(chips(page)).toHaveText(['duration.300', 'delay.120']);
    await expect(wheres(page)).toHaveText(['duration', 'stagger']);
    await page.goto('/?view=component&component=card&version=v1&runtime=motion');
    await expect(chips(page)).toHaveText(['duration.220', 'delay.70', 'distance.16']);
    await page.goto('/?view=component&component=side-panel&version=v3&runtime=motion');
    await expect(page.locator('.lab-tokens-layer')).toHaveText(['root', 'title', 'list', 'actions']);
    await expect(chips(page)).not.toContainText(['easing.productive-entrance']);
    await expect(page.locator('#tokens-used-list')).not.toContainText('easing.');
    await page.click('#runtime-css');
    await expect(page.locator('#tokens-used-list')).toContainText('easing.expressive-entrance');
  });

  test('a version with layers groups the tokens by motion: the root, then each layer', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v4');
    await expect(page.locator('.lab-tokens-layer')).toHaveText(['root', 'title', 'text']);
    await expect(page.locator('.lab-tokens-layer').nth(1)).toHaveAttribute('title', 'The element marked data-motion="title"');
    await expect(chips(page)).toHaveText([
      'duration.220', 'easing.productive-entrance', 'delay.70', 'distance.16',
      'duration.300', 'easing.productive-entrance', 'delay.70', 'distance.8',
      'duration.300', 'easing.productive-entrance', 'delay.120', 'distance.8',
    ]);
    await expect(wheres(page)).toHaveText([
      'duration', 'easing', 'stagger', '0% transform',
      'duration', 'easing', 'delay', '0% transform',
      'duration', 'easing', 'delay', '0% transform',
    ]);
  });

  test('a version that follows the pairing rules shows no pairing warning', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v4');
    await expect(page.locator('#tokens-used-list')).not.toContainText('Pairing');
  });

  test('there is no CSS / Spring engine toggle', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(page.locator('#engine-css')).toHaveCount(0);
    await expect(page.locator('#engine-spring')).toHaveCount(0);
  });

  test('the generated CSS for a spring has no linear() curve: CSS plays its easing', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    const css = page.locator('#css-pre');
    await expect(css).toContainText('/* authored as a spring of easing.productive-entrance; CSS plays its easing, only a spring runtime (Motion) bounces */');
    await expect(css).toContainText('animation-timing-function: var(--motion-easing-productive-entrance');
    await expect(css).not.toContainText('linear(');
  });
});
