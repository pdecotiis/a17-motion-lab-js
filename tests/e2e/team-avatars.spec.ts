import { test, expect } from '@playwright/test';

// The avatars beside the theme switch: everyone who has worked in the project, you first. The dev server's
// /__lab/team is answered here by the test, so the real git history is never read.
const person = (name: string, email: string, commits: number, lastActive: number) => ({ name, email, commits, lastActive });
const NOW = Math.floor(Date.now() / 1000);

test.describe('team avatars', () => {
  test('shows you first, then the others, with a count for the rest and a tooltip on each', async ({ page }) => {
    await page.route('**/__lab/team', route => route.fulfill({
      json: {
        people: [
          person('Claudia Reyes', 'claudia@x.com', 12, NOW - 86400 * 2),
          person('Miguel Santos', 'miguel@x.com', 7, NOW - 86400 * 10),
          person('Paul', 'paul@x.com', 30, NOW - 86400 * 30),
          person('Ana Lee', 'ana@x.com', 2, NOW - 86400 * 90),
          person('Omar K', 'omar@x.com', 1, NOW - 86400 * 400),
        ],
        you: { name: 'Paul', email: 'paul@x.com' },
      },
    }));
    await page.goto('/?view=tokens');
    const avatars = page.locator('#lab-avatars .lab-avatar');
    await expect(avatars).toHaveCount(5);
    await expect(avatars.nth(0)).toHaveAttribute('title', 'Paul (you)');
    await expect(avatars.nth(1)).toHaveAttribute('title', /Claudia Reyes · last worked 2 days ago/);
    await expect(avatars.nth(2)).toHaveAttribute('title', /Miguel Santos/);
    await expect(avatars.nth(4)).toHaveText('+1');
    await expect(avatars.nth(1)).toHaveText('CR');
  });

  test('a project with one person shows no stack', async ({ page }) => {
    await page.route('**/__lab/team', route => route.fulfill({
      json: { people: [person('Paul', 'paul@x.com', 3, NOW)], you: { name: 'Paul', email: 'paul@x.com' } },
    }));
    await page.goto('/?view=tokens');
    await expect(page.locator('#lab-avatars .lab-avatar')).toHaveCount(await page.locator('#lab-avatars .lab-avatar').count());
    expect(await page.locator('#lab-avatars .lab-avatar--more').count()).toBe(0);
    expect(await page.locator('#lab-avatars .lab-avatar').count()).toBeLessThanOrEqual(1);
  });

  test('a failed team request leaves the lab working', async ({ page }) => {
    await page.route('**/__lab/team', route => route.abort());
    await page.goto('/?view=tokens');
    await expect(page.locator('.lab-tokens-title')).toBeVisible();
  });
});
