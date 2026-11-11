import { test, expect } from '@playwright/test';
import { compareToBaseline, MAX_DIFF_RATIO } from './visual.js';

test.describe('Menu', () => {
  test('renders the component', async ({ page }) => {
    await page.goto('/?view=component&component=menu');
    await expect(page.locator('[data-motion-target]').first()).toBeVisible();
    await expect(page.getByText('Life at Jane Street').first()).toBeVisible();
    await expect(page.getByText('Who We Are').first()).toBeHidden();   // About is closed, like the other two
  });

  test('v1 plays without error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=component&component=menu&version=v1');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });


  test('v2 plays without error, and every element comes in top down, 15ms apart: a 140ms rise and its own 100ms fade', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/?view=component&component=menu&version=v2');
    const rows = page.locator('#preview-inner-primary [data-motion="row"]');
    // the logo, the three parent rows (About is closed, so its children are not part of the entrance), then the sidebar button and the mode switch
    await expect(rows).toHaveCount(6);
    await page.click('#replay-btn');
    const timings = await rows.evaluateAll(els => els.map(el => el.getAnimations().map(a => {
      const t = (a.effect as KeyframeEffect).getTiming();
      const k = (a.effect as KeyframeEffect).getKeyframes()[0] as Record<string, unknown>;
      return { property: k['transform'] !== undefined ? 'move' : 'fade', delay: t.delay as number, duration: t.duration as number, from: String(k['transform'] ?? k['opacity']) };
    })));
    timings.forEach((animations, i) => {
      const move = animations.find(a => a.property === 'move')!;
      const fade = animations.find(a => a.property === 'fade')!;
      expect(move, `element ${i}`).toMatchObject({ delay: 15 + 15 * i, duration: 140, from: 'translateY(8px)' });
      expect(fade, `element ${i}`).toMatchObject({ delay: 15 + 15 * i, duration: 100, from: '0' });
    });
    await page.waitForTimeout(800);
    expect(errors).toHaveLength(0);
  });

  test('v2 collapses to the mark when the sidebar button is clicked, and opens again', async ({ page }) => {
    await page.goto('/?view=component&component=menu&version=v2');
    const root = page.locator('#preview-inner-primary [data-motion-target]');
    const nav = page.locator('#preview-inner-primary [data-motion="submenu"]');
    await expect.poll(async () => Math.round((await root.boundingBox())!.width), { timeout: 4000 }).toBe(304);
    await page.locator('#preview-inner-primary [data-motion="close"]').click();
    await expect.poll(async () => Math.round((await root.boundingBox())!.width), { timeout: 4000 }).toBe(96);
    await expect.poll(() => nav.evaluate(el => getComputedStyle(el).opacity)).toBe('0');
    await page.locator('#preview-inner-primary [data-motion="close"]').click();
    await expect.poll(async () => Math.round((await root.boundingBox())!.width), { timeout: 4000 }).toBe(304);
    await expect.poll(() => nav.evaluate(el => getComputedStyle(el).opacity)).toBe('1');
  });

  test('static end state matches the Figma screenshot', async ({ page }) => {
    const result = await compareToBaseline(page, 'menu', 'v1');
    expect(result.ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
  });
});
