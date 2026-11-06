import { test, expect } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Every version of every component in the repo plays in the lab without console errors, and starts at least
// one animation. The list is read from components/ when the tests are collected, so a new component or
// version is covered here without a spec of its own.

const componentsDir = join(process.cwd(), 'components');
const versions: { component: string; id: string }[] = [];
for (const component of readdirSync(componentsDir).sort()) {
  const dir = join(componentsDir, component, 'versions');
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter(f => /^v\d+\.ts$/.test(f)).sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10))) {
    versions.push({ component, id: file.replace(/\.ts$/, '') });
  }
}

test.describe('every version plays', () => {
  test('finds versions to play', () => {
    expect(versions.length).toBeGreaterThan(0);
  });

  for (const { component, id } of versions) {
    test(`${component} ${id} plays without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', err => errors.push(err.message));
      // Count the animations the version starts: a finite one (a click-only version's first move) can be over before a slow page is checked.
      await page.addInitScript(() => {
        (window as unknown as { __animations: number }).__animations = 0;
        const start = Element.prototype.animate;
        Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
          (window as unknown as { __animations: number }).__animations++;
          return start.apply(this, args);
        };
      });
      await page.goto(`/?view=component&component=${component}&version=${id}`);
      await expect(page.locator('[data-motion-target]').first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => (window as unknown as { __animations: number }).__animations), { timeout: 10000 }).toBeGreaterThan(0);
      await page.waitForLoadState('networkidle');
      expect(errors).toEqual([]);
    });
  }
});
