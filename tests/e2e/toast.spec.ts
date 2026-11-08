import { test, expect } from '@playwright/test';

// A toast confirms an action: bottom right, it slides in, holds while the pointer is on it, then goes by itself.
// (lab/lib/toast.ts; a save that reloads the page keeps its message for the view that comes back.)
const pending = (message: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ message, ...extra });

test.describe('toasts', () => {
  test('appear in the bottom right, then go by themselves', async ({ page }) => {
    await page.addInitScript(value => { if (!sessionStorage.getItem('seen')) { sessionStorage.setItem('seen', '1'); sessionStorage.setItem('lab-toast-pending', value); } }, pending('Saved as v9', { description: 'Both lift', duration: 2500 }));
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/?view=tokens');
    const toast = page.locator('.lab-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Saved as v9');
    await expect(toast).toContainText('Both lift');
    await expect(toast).toHaveClass(/lab-toast--in/);
    const box = (await toast.boundingBox())!;
    expect(Math.round(box.x + box.width)).toBe(1200 - 16);      // against the right
    expect(Math.round(box.y + box.height)).toBe(800 - 16);       // and the bottom
    await expect(toast).toHaveCount(0, { timeout: 6000 });       // gone after its time
  });

  test('wait while the pointer is on them', async ({ page }) => {
    await page.addInitScript(value => { if (!sessionStorage.getItem('seen')) { sessionStorage.setItem('seen', '1'); sessionStorage.setItem('lab-toast-pending', value); } }, pending('Held', { duration: 2000 }));
    await page.goto('/?view=tokens');
    const toast = page.locator('.lab-toast');
    await expect(toast).toBeVisible();
    await toast.hover();
    await page.waitForTimeout(2800);
    await expect(toast).toBeVisible();                            // held past its time
    await page.mouse.move(5, 5);
    await expect(toast).toHaveCount(0, { timeout: 6000 });
  });

  test('a click dismisses one, and the kept message shows once only', async ({ page }) => {
    await page.addInitScript(value => { if (!sessionStorage.getItem('seen')) { sessionStorage.setItem('seen', '1'); sessionStorage.setItem('lab-toast-pending', value); } }, pending('Click me away', { duration: 8000 }));
    await page.goto('/?view=tokens');
    await page.locator('.lab-toast').click();
    await expect(page.locator('.lab-toast')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.lab-toast')).toHaveCount(0);
  });

  test('an error toast is an alert', async ({ page }) => {
    await page.addInitScript(value => { if (!sessionStorage.getItem('seen')) { sessionStorage.setItem('seen', '1'); sessionStorage.setItem('lab-toast-pending', value); } }, pending('Could not save', { kind: 'error', duration: 3000 }));
    await page.goto('/?view=tokens');
    await expect(page.locator('.lab-toast--error')).toHaveAttribute('role', 'alert');
  });
});
