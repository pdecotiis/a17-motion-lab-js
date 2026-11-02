import { test, expect, type Page } from '@playwright/test';

// Interactions (spike): the side panel's v4 is two states, closed and open, and a transition into each.
// The stage gets state buttons; a click on anything marked data-motion-set moves the component too.
const ROOT = '#preview-inner-primary [data-motion-target]';
const url = (runtime: 'css' | 'motion', version = 'v4') => `/?view=component&component=side-panel&version=${version}&runtime=${runtime}`;
const playbackRow = (page: Page) => page.locator('#version-spec-meta dt:has-text("Playback") + dd');
const stateNow = (page: Page) => page.locator('#state-now');

// x of the panel (px) over the next `ms`, one sample a frame: [t, x, data-state].
async function trace(page: Page, ms: number): Promise<[number, number, string][]> {
  return page.evaluate(async ({ sel, ms }) => {
    const el = document.querySelector<HTMLElement>(sel)!;
    const out: [number, number, string][] = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      out.push([performance.now() - t0, new DOMMatrixReadOnly(getComputedStyle(el).transform).m41, el.dataset['state'] ?? '']);
      await new Promise(requestAnimationFrame);
    }
    return out;
  }, { sel: ROOT, ms });
}
const settled = async (page: Page) => expect(page.locator('#state-now[data-moving="false"]')).toBeVisible({ timeout: 4000 });

test.describe('Interactions: states', () => {
  for (const runtime of ['css', 'motion'] as const) {
    test.describe(`under ${runtime}`, () => {
      test('the stage has the states, and the panel opens on load', async ({ page }) => {
        await page.goto(url(runtime));
        await expect(page.locator('#interaction-controls')).toBeVisible();
        await expect(page.locator('[data-state-btn]')).toHaveText(['closed', 'open']);
        await expect(page.locator(ROOT)).toHaveAttribute('data-state', 'open');
        await settled(page);
        await expect(stateNow(page)).toHaveText('State: open');
        await expect(page.locator('[data-state-btn="open"]')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('[data-state-btn="closed"]')).toHaveAttribute('aria-pressed', 'false');
      });

      test('a state button moves the panel there, and it arrives', async ({ page }) => {
        await page.goto(url(runtime));
        await settled(page);
        await page.click('[data-state-btn="closed"]');
        await expect(page.locator(ROOT)).toHaveAttribute('data-state', 'closed');
        await settled(page);
        await expect.poll(async () => (await trace(page, 60)).at(-1)![1], { timeout: 4000 }).toBeCloseTo(48, 0);
        await expect.poll(() => page.evaluate(sel => getComputedStyle(document.querySelector(sel)!).opacity, ROOT)).toBe('0');
        await page.click('[data-state-btn="open"]');
        await settled(page);
        await expect.poll(async () => (await trace(page, 60)).at(-1)![1], { timeout: 4000 }).toBeCloseTo(0, 0);
      });

      test('Toggle goes to the other state; the × inside the panel closes it', async ({ page }) => {
        await page.goto(url(runtime));
        await settled(page);
        await page.click('#state-toggle');
        await expect(page.locator(ROOT)).toHaveAttribute('data-state', 'closed');
        await settled(page);
        await page.click('#state-toggle');
        await expect(page.locator(ROOT)).toHaveAttribute('data-state', 'open');
        await settled(page);
        await page.click('.side-panel__close');
        await expect(page.locator(ROOT)).toHaveAttribute('data-state', 'closed');
      });

      test('Interrupt: open, then closed 150ms in, before it arrives, and it ends closed with no jump', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(url(runtime));
        await settled(page);
        const done = trace(page, 1800);
        await page.click('#state-interrupt');
        const samples = await done;
        const states = [...new Set(samples.map(s => s[2]))];
        expect(states).toContain('open');
        expect(samples.at(-1)![2]).toBe('closed');
        // it never got all the way open: the move back started partway
        const atSwitch = samples.find(s => s[2] === 'closed' && s[0] > 100)!;
        expect(atSwitch[1]).toBeGreaterThan(5);
        expect(atSwitch[1]).toBeLessThan(44);
        // no frame jumps once it is moving: a retarget starts from where the panel is. (Interrupt begins by
        // resetting to closed, a jump by design, so count from 60ms in.)
        const from = samples.findIndex(x => x[0] > 60);
        for (let i = from + 1; i < samples.length; i++) expect(Math.abs(samples[i]![1] - samples[i - 1]![1]), `frame ${i}`).toBeLessThan(14);
        expect(samples.at(-1)![1]).toBeGreaterThan(40);
        expect(errors).toEqual([]);
      });
    });
  }

  test('Playback names the transition into each state, as the runtime plays it', async ({ page }) => {
    await page.goto(url('css'));
    await expect(playbackRow(page)).toHaveText([
      'into closed: Easing · productive-exit, 300ms (authored as a spring; CSS plays its easing)',
      'into open: Easing · expressive-entrance, 560ms (authored as a spring; CSS plays its easing)',
    ].join('\n'));
    await page.goto(url('motion'));
    await expect(playbackRow(page)).toHaveText([
      'into closed: Spring · bounce 0 (bounce.0), 300ms',
      'into open: Spring · bounce 0.5 (bounce.50), 560ms',
    ].join('\n'));
  });

  test('opening bounces under Motion (bounce.50) and never overshoots under CSS', async ({ page }) => {
    for (const runtime of ['css', 'motion'] as const) {
      await page.goto(url(runtime));
      await settled(page);
      await page.click('[data-state-btn="closed"]');
      await settled(page);
      const done = trace(page, 1500);
      await page.click('[data-state-btn="open"]');
      const xs = (await done).map(s => s[1]);
      if (runtime === 'motion') expect(Math.min(...xs), 'motion').toBeLessThan(-2);
      else expect(Math.min(...xs), 'css').toBeGreaterThan(-1);
    }
  });

  test('a version with no states has no state controls, and still plays as before', async ({ page }) => {
    await page.goto(url('css', 'v2'));
    await expect(page.locator('#interaction-controls')).toBeHidden();
    await expect(page.locator('#replay-btn')).toBeVisible();
  });

  test('Replay goes back to closed and opens again', async ({ page }) => {
    await page.goto(url('css'));
    await settled(page);
    await page.click('[data-state-btn="closed"]');
    await settled(page);
    await page.click('#replay-btn');
    await expect(page.locator(ROOT)).toHaveAttribute('data-state', 'open');
  });

  test('reduced motion: the opacity still fades, the movement snaps', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url('css'));
    await settled(page);
    await page.click('[data-state-btn="closed"]');
    await settled(page);
    const done = trace(page, 200);
    await page.click('[data-state-btn="open"]');
    const samples = await done;
    // the frames once it is open are already in their place: no slide
    const open = samples.filter(s => s[2] === 'open').slice(0, 4);
    expect(open.length).toBeGreaterThan(1);
    expect(open.every(s => Math.abs(s[1]) < 1)).toBe(true);
  });

  test('the speed control reaches a move in progress', async ({ page }) => {
    await page.goto(url('css'));
    await settled(page);
    await page.selectOption('#speed-control', '0.25');
    await page.click('[data-state-btn="closed"]');
    await page.waitForTimeout(500);
    expect(await page.evaluate(sel => Number(getComputedStyle(document.querySelector(sel)!).opacity), ROOT)).toBeGreaterThan(0.1);
  });
});

test.describe('Interactions: tokens and exports', () => {
  const chips = (page: Page) => page.locator('#tokens-used-list .lab-token-chip');

  test('Tokens used lists each transition\'s tokens and where in the states they sit', async ({ page }) => {
    await page.goto(url('css'));
    await expect(chips(page).locator('code')).toContainText(['duration.560', 'easing.expressive-entrance', 'duration.300', 'easing.productive-exit', 'distance.48']);
    await expect(page.locator('#tokens-used-list')).toContainText('into open duration');
    await expect(page.locator('#tokens-used-list')).toContainText('closed transform');
    await expect(page.locator('#tokens-used-list')).not.toContainText('Pairing');
  });

  test('under Motion no easing is listed, and each transition lists its bounce token', async ({ page }) => {
    await page.goto(url('motion'));
    await expect(page.locator('#tokens-used-list')).toContainText('bounce.50');
    await expect(page.locator('#tokens-used-list')).toContainText('into closed bounce');
    await expect(page.locator('#tokens-used-list')).not.toContainText('easing.');
  });

  test('the code panel gives CSS transitions, and GSAP and Motion functions that go to a state', async ({ page }) => {
    await page.goto(url('css'));
    await page.locator('.lab-sidebar > details > summary', { hasText: 'Generated code' }).click();
    const pre = page.locator('#css-pre');
    await expect(pre).toContainText('.motion-side-panel-v4[data-state="open"]');
    await expect(pre).toContainText('transition-duration: var(--motion-duration-560, 560ms);');
    await page.selectOption('#export-format', 'gsap');
    await expect(pre).toContainText('export function goToSidePanelV4(el, state)');
    await expect(pre).toContainText('overwrite: "auto"');
    await page.selectOption('#export-format', 'motion');
    await expect(pre).toContainText('type: "spring", visualDuration: 0.56, bounce: 0.5');
  });
});
