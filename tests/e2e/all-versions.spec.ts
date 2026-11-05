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
      await page.goto(`/?view=component&component=${component}&version=${id}`);
      await expect(page.locator('[data-motion-target]').first()).toBeVisible();
      expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
      await page.waitForLoadState('networkidle');
      expect(errors).toEqual([]);
    });
  }
});
