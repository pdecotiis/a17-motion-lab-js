import { test, expect } from '@playwright/test';

test.describe('prefers-reduced-motion', () => {
  test('shows reduced motion notice when emulated', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?view=component&component=card');
    await expect(page.locator('#reduced-motion-notice')).toBeVisible();
  });

  test('does not show notice in normal mode', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?view=component&component=card');
    await expect(page.locator('#reduced-motion-notice')).not.toBeVisible();
  });

  // What the lab plays has to match the reduced-motion block in the exported CSS:
  // opacity only, no movement, at most 150ms.
  const playedAnimation = (page: import('@playwright/test').Page) =>
    page.evaluate(() => {
      const anim = document.querySelector<HTMLElement>('[data-motion-target]')!.getAnimations()[0]!;
      const effect = anim.effect as KeyframeEffect;
      return {
        duration: effect.getTiming().duration,
        properties: [...new Set(effect.getKeyframes().flatMap(kf => Object.keys(kf)))]
          .filter(k => !['offset', 'easing', 'composite', 'computedOffset'].includes(k))
          .sort(),
      };
    });

  test('a tween plays a short opacity-only fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?view=frame&component=card&version=v1');
    expect(await playedAnimation(page)).toEqual({ duration: 150, properties: ['opacity'] });
  });

  test('a tween plays in full when reduced motion is not requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?view=frame&component=card&version=v1');
    expect(await playedAnimation(page)).toEqual({ duration: 220, properties: ['opacity', 'transform'] });
  });

  test('a layer plays the same short opacity-only fade as the root', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?view=frame&component=card&version=v4');
    const title = await page.evaluate(() => {
      const anim = document.querySelector<HTMLElement>('[data-motion="title"]')!.getAnimations()[0]!;
      const effect = anim.effect as KeyframeEffect;
      return {
        duration: effect.getTiming().duration,
        properties: [...new Set(effect.getKeyframes().flatMap(kf => Object.keys(kf)))]
          .filter(k => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)).sort(),
      };
    });
    expect(title).toEqual({ duration: 150, properties: ['opacity'] });
  });
});
