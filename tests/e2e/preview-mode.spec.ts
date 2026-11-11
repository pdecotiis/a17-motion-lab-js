import { test, expect } from '@playwright/test';

// Preview mode (`&preview=1`): just the component or page, filling the window. It is the same view with the chrome hidden, so it plays as it
// does there. R replays, the arrow keys move between versions, Esc leaves. These use the lab's defaults, so they run on any project.
test.describe('preview mode', () => {
  test('a component fills the window with no header, top bar or panel, and the bar names it', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/?view=component&preview=1');
    for (const hidden of ['.lab-header', '.lab-viewbar', '.lab-sidebar']) await expect(page.locator(hidden)).toBeHidden();
    const stage = (await page.locator('#preview-primary').boundingBox())!;
    expect(Math.round(stage.x)).toBe(0);
    expect(Math.round(stage.width)).toBe(1200);
    expect(Math.round(stage.height)).toBeGreaterThanOrEqual(800);
    await expect(page.locator('#lab-preview-bar')).toHaveClass(/lab-preview-bar--shown/);
    await expect(page.locator('.lab-preview-bar__name')).not.toBeEmpty();
    expect(errors).toEqual([]);
  });

  test('Esc leaves, and the Preview button comes back in', async ({ page }) => {
    await page.goto('/?view=component&preview=1');
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/preview=1/);
    await expect(page.locator('.lab-header')).toBeVisible();
    await page.click('#preview-btn');
    await expect(page).toHaveURL(/preview=1/);
    await expect(page.locator('.lab-header')).toBeHidden();
    await page.click('#preview-exit');
    await expect(page).not.toHaveURL(/preview=1/);
  });

  test('R replays the motion', async ({ page }) => {
    await page.goto('/?view=component&preview=1');
    const root = page.locator('.lab-preview [data-motion-target]').first();
    await page.waitForTimeout(1500);
    await page.keyboard.press('r');
    // a replay starts animations on the component again
    await expect.poll(() => root.evaluate(el => el.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
  });

  test('the arrow keys move between versions, and stay in preview', async ({ page }) => {
    await page.goto('/?view=component&preview=1');
    const count = await page.locator('.lab-version-tab').count();
    test.skip(count < 2, 'this component has one version');
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/version=v2/);
    await expect(page).toHaveURL(/preview=1/);
    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(/version=v1/);
  });

  test('a page is fitted to the window, and Esc leaves', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto('/?view=page&preview=1');
    test.skip((await page.locator('.lab-page-grid').count()) === 0, 'this project has no pages');
    for (const hidden of ['.lab-header', '.lab-viewbar', '.lab-sidebar']) await expect(page.locator(hidden)).toBeHidden();
    const grid = (await page.locator('.lab-page-grid').boundingBox())!;
    expect(grid.x + grid.width).toBeLessThanOrEqual(900 + 1);         // nothing runs off the window: it is scaled to fit
    const stage = page.locator('#page-stage');
    expect(await stage.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/preview=1/);
    await expect(page.locator('.lab-sidebar')).toBeVisible();
  });

  test('the window is white and the design has a subtle hairline around it, adding no size', async ({ page }) => {
    await page.goto('/?view=component&preview=1');
    const inner = page.locator('#preview-inner-primary');
    await expect(inner).toBeVisible();
    expect(await inner.evaluate(el => { const c = getComputedStyle(el); return [c.outlineStyle, c.outlineWidth, c.borderTopWidth]; })).toEqual(['solid', '1px', '0px']);
    await expect(page.locator('#preview-primary')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await page.goto('/?view=page&preview=1');
    test.skip((await page.locator('.lab-page-grid').count()) === 0, 'this project has no pages');
    await expect(page.locator('.lab-page-viewport')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    expect(await page.locator('.lab-page-grid').evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');   // a page has no outline
  });

  test('the little bar does not come back when the pointer moves: Hide (or H) puts it away, H brings it back', async ({ page }) => {
    await page.goto('/?view=component&preview=1');
    const bar = page.locator('#lab-preview-bar');
    await expect(bar).toHaveClass(/lab-preview-bar--shown/);
    await page.click('#preview-hide');
    await expect(bar).not.toHaveClass(/lab-preview-bar--shown/);
    await page.mouse.move(300, 300); await page.mouse.move(600, 500); await page.mouse.move(100, 700);
    await page.waitForTimeout(300);
    await expect(bar).not.toHaveClass(/lab-preview-bar--shown/);   // moving the pointer does not show it
    await page.keyboard.press('h');
    await expect(bar).toHaveClass(/lab-preview-bar--shown/);
    await page.waitForTimeout(4500);
    await expect(bar).toHaveClass(/lab-preview-bar--shown/);       // brought back by hand, it stays
    await page.keyboard.press('h');
    await expect(bar).not.toHaveClass(/lab-preview-bar--shown/);
  });

  test('on its own the bar goes after a few seconds', async ({ page }) => {
    await page.goto('/?view=component&preview=1');
    await expect(page.locator('#lab-preview-bar')).toHaveClass(/lab-preview-bar--shown/);
    await expect(page.locator('#lab-preview-bar')).not.toHaveClass(/lab-preview-bar--shown/, { timeout: 6000 });
  });
});
