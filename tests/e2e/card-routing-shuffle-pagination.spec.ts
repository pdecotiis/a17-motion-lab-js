import { test, expect } from '@playwright/test';

// v5: the pagination. A bullet goes to its arrangement, the arrows step round, and the pause button stops the timer.
test('card-routing-shuffle v5: bullets, arrows and pause', async ({ page }) => {
  await page.goto('/?view=component&component=card-routing-shuffle&version=v5&preview=1');
  const root = page.locator('.card-routing-shuffle');
  await expect(root).toHaveAttribute('data-pausable', '');
  await expect(root).toHaveAttribute('data-state', /arrangement-/, { timeout: 8000 });
  await page.click('[data-motion="dot-3"]');
  await expect(root).toHaveAttribute('data-state', 'arrangement-3');
  await page.click('[data-motion="next"]');
  await expect(root).toHaveAttribute('data-state', 'arrangement-4');
  await page.click('[data-motion="next"]');
  await expect(root).toHaveAttribute('data-state', 'arrangement-1');   // round to the first
  await page.click('[data-motion="playpause"]');
  await expect(root).toHaveAttribute('data-paused', '');
  await page.waitForTimeout(5800);
  await expect(root).toHaveAttribute('data-state', 'arrangement-1');   // paused: it did not step by itself
  await page.click('[data-motion="playpause"]');
  await expect(root).not.toHaveAttribute('data-paused', '');
  await expect(root).toHaveAttribute('data-state', 'arrangement-2', { timeout: 7000 });
});

// Hovering a colour card holds the timer and the fill; moving away carries on. The pagination pill does not hold it.
test('card-routing-shuffle v5: hover holds the carousel', async ({ page }) => {
  await page.goto('/?view=component&component=card-routing-shuffle&version=v5&preview=1');
  const root = page.locator('.card-routing-shuffle');
  await expect(root).toHaveAttribute('data-state', /arrangement-/, { timeout: 8000 });
  await page.click('[data-motion="dot-1"]');
  await expect(root).toHaveAttribute('data-state', 'arrangement-1');
  await page.hover('[data-motion="dots"]');
  await expect(root).not.toHaveAttribute('data-held', '');
  await page.hover('[data-motion="o0"]');
  await expect(root).toHaveAttribute('data-held', '');
  await page.waitForTimeout(5800);
  await expect(root).toHaveAttribute('data-state', 'arrangement-1');   // held: it did not step
  await page.mouse.move(2, 2);
  await expect(root).not.toHaveAttribute('data-held', '');
  await expect(root).toHaveAttribute('data-state', 'arrangement-2', { timeout: 7000 });
});
