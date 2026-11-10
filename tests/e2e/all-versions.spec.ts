import { test, expect } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Every version of every component in the repo plays in the lab without console errors, and starts at least one animation. The list is
// read from components/ when the tests are collected, so a new component or version is covered here without a spec of its own.
// One test per component: the lab loads once and each version is opened from its tab in the Version panel, which is a few times
// faster than loading the lab for every version (this test grew with every version added).

const componentsDir = join(process.cwd(), 'components');
if (!existsSync(componentsDir)) throw new Error('components/ is missing: keep the folder (components/.gitkeep) even when it is empty');
const byComponent = new Map<string, string[]>();
for (const component of readdirSync(componentsDir).sort()) {
  const dir = join(componentsDir, component, 'versions');
  if (!existsSync(dir)) continue;
  const ids = readdirSync(dir).filter(f => /^v\d+\.ts$/.test(f)).sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)).map(f => f.replace(/\.ts$/, ''));
  if (ids.length) byComponent.set(component, ids);
}

test.describe('every version plays', () => {
  // A fresh project has no components yet (the lab shows its empty state): there is then nothing to play.
  test('finds the versions to play', () => {
    test.skip(byComponent.size === 0, 'no components in this project yet');
    expect(byComponent.size).toBeGreaterThan(0);
  });

  for (const [component, ids] of byComponent) {
    test(`${component}: every version plays without console errors (${ids.join(', ')})`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', err => errors.push(err.message));
      // Count the animations started: a finite one (a click-only version's first move) can be over before a slow page is checked.
      await page.addInitScript(() => {
        (window as unknown as { __animations: number }).__animations = 0;
        const start = Element.prototype.animate;
        Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
          (window as unknown as { __animations: number }).__animations++;
          return start.apply(this, args);
        };
      });
      const animations = () => page.evaluate(() => (window as unknown as { __animations: number }).__animations);
      await page.goto(`/?view=component&component=${component}&version=${ids[0]}`);
      for (const [i, id] of ids.entries()) {
        const before = i === 0 ? 0 : await animations();   // the first version starts as the page loads
        // An archived version is disabled in the tabs (and is not played from there): it is left out.
        if (i > 0) {
          const tab = page.locator('.lab-version-tab', { hasText: new RegExp(`^${id}:`) });
          if (await tab.isDisabled()) continue;
          await tab.click();
        }
        await expect(page.locator('[data-motion-target]').first(), id).toBeVisible();
        await expect.poll(animations, { timeout: 10000, message: `${component} ${id} starts an animation` }).toBeGreaterThan(before);
      }
      await page.waitForLoadState('networkidle');
      expect(errors).toEqual([]);
    });
  }
});
