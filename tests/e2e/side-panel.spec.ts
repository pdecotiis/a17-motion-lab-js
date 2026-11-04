import { test, expect, type Page } from '@playwright/test';

// The side panel is the example for comparing CSS and Motion: v2 and v3 are springs, so under Motion
// the panel overshoots its resting position, and under CSS it never does.
const ROOT = '#preview-inner-primary [data-motion-target]';

// How far the panel gets past its resting position (the most negative x it reaches while it plays).
async function overshootPx(page: Page): Promise<number> {
  return page.evaluate(async (sel) => {
    const el = document.querySelector<HTMLElement>(sel)!;
    let min = 0;
    const end = performance.now() + 1500;
    while (performance.now() < end) {
      min = Math.min(min, new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
      await new Promise(requestAnimationFrame);
    }
    return -min;
  }, ROOT);
}

test.describe('Side panel', () => {
  test('renders the component', async ({ page }) => {
    await page.goto('/?view=component&component=side-panel');
    await expect(page.locator('#preview-inner-primary .side-panel')).toBeVisible();
    await expect(page.locator('.side-panel__title')).toHaveText('Notifications');
  });

  for (const runtime of ['css', 'motion']) {
    for (const version of ['v1', 'v2']) {
      test(`${version} plays without console errors under ${runtime}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(`/?view=component&component=side-panel&version=${version}&runtime=${runtime}`);
        await page.click('#replay-btn');
        await page.waitForTimeout(800);
        expect(errors).toEqual([]);
      });
    }
  }

  test('the spring overshoots under Motion but not under CSS', async ({ page }) => {
    await page.goto('/?view=component&component=side-panel&version=v1&runtime=css');
    let done = overshootPx(page);
    await page.click('#replay-btn');
    expect(await done).toBeLessThan(1);

    await page.click('#runtime-motion');
    await expect(page.locator(ROOT)).toBeVisible();
    done = overshootPx(page);
    await page.click('#replay-btn');
    expect(await done).toBeGreaterThan(2);
  });

  test('v1 plays everything as a spring under Motion: the panel keeps its bounce, the content uses the global one', async ({ page }) => {
    await page.goto('/?view=component&component=side-panel&version=v1&runtime=motion');
    const note = ' (authored as easing; bounce is the global setting)';
    await expect(page.locator('#version-spec-meta dt:has-text("Playback") + dd')).toHaveText([
      'Spring · bounce 0.5 (bounce.50), 560ms',
      `title: Spring · bounce 0.25 (bounce.25), 300ms${note}`,
      `list: Spring · bounce 0.25 (bounce.25), 300ms${note}`,
      `actions: Spring · bounce 0.25 (bounce.25), 300ms${note}`,
    ].join('\n'));
  });
});
