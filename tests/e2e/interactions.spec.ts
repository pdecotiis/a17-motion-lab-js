import { test, expect, type Page } from '@playwright/test';

// Interactions (spike): the side panel's v2 is two states, closed and open, and a transition into each.
// The stage gets state buttons; a click on anything marked data-motion-set moves the component too.
const ROOT = '#preview-inner-primary [data-motion-target]';
const url = (runtime: 'css' | 'motion', version = 'v2') => `/?view=component&component=side-panel&version=${version}&runtime=${runtime}`;
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
    await page.goto(url('css', 'v1'));
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
    await expect(chips(page).locator('code')).toContainText(['duration-560', 'expressive-entrance', 'duration-300', 'productive-exit', 'distance-48']);
    await expect(page.locator('#tokens-used-list')).toContainText('into open duration');
    await expect(page.locator('#tokens-used-list')).toContainText('closed transform');
    await expect(page.locator('#tokens-used-list')).not.toContainText('Pairing');
  });

  test('under Motion no easing is listed, and each transition lists its bounce token', async ({ page }) => {
    await page.goto(url('motion'));
    await expect(page.locator('#tokens-used-list')).toContainText('bounce-50');
    await expect(page.locator('#tokens-used-list')).toContainText('into closed bounce');
    await expect(page.locator('#tokens-used-list')).not.toContainText(/(productive|expressive)-/);
  });

  test('the code panel gives CSS transitions, and GSAP and Motion functions that go to a state', async ({ page }) => {
    await page.goto(url('css'));
    await page.locator('.lab-sidebar > details > summary', { hasText: 'Generated code' }).click();
    const pre = page.locator('#css-pre');
    await expect(pre).toContainText('.motion-side-panel-v2[data-state="open"]');
    await expect(pre).toContainText('transition-duration: var(--motion-duration-560, 560ms);');
    await page.selectOption('#export-format', 'gsap');
    await expect(pre).toContainText('export function goToSidePanelV2(el, state)');
    await expect(pre).toContainText('overwrite: "auto"');
    await page.selectOption('#export-format', 'motion');
    await expect(pre).toContainText('type: "spring", visualDuration: 0.56, bounce: 0.5');
  });
});

// The card's v2 "Hover Lift": v1's entrance (fade up, title and text follow), then states. Hover lifts it 4px,
// press scales it to 98%. The entrance plays first and the states are locked until it ends.
test.describe('Interactions: entrance, then hover and press on the card', () => {
  const CARD = '#preview-inner-primary [data-motion-target]';
  const TEXT = `${CARD} [data-motion="text"]`;
  const cardUrl = (runtime: 'css' | 'motion') => `/?view=component&component=card&version=v2&runtime=${runtime}`;
  // The card's lift (px, up is negative), its scale and its opacity, right now.
  const pose = (page: Page) => page.evaluate(card => {
    const el = document.querySelector(card)!;
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return { lift: +m.m42.toFixed(2), scale: +m.m11.toFixed(3), opacity: +Number(getComputedStyle(el).opacity).toFixed(3) };
  }, CARD);
  const settledPose = async (page: Page, expected: Partial<{ lift: number; scale: number; opacity: number }>) => {
    await expect.poll(() => pose(page), { timeout: 4000 }).toMatchObject(Object.fromEntries(
      Object.entries(expected).map(([k, v]) => [k, expect.closeTo(v, 1)]),
    ));
  };
  // The entrance has finished (the last layer, the text, has arrived) and the states have had time to go live.
  const entranceDone = async (page: Page, runtime: 'css' | 'motion' = 'css') => {
    await expect.poll(() => page.evaluate(sel => Number(getComputedStyle(document.querySelector(sel)!).opacity), TEXT), { timeout: 5000 }).toBeGreaterThan(0.999);
    // Under Motion the springs are still settling a little after they visually arrive.
    await page.waitForTimeout(runtime === 'motion' ? 1500 : 150);
  };

  for (const runtime of ['css', 'motion'] as const) {
    test.describe(`under ${runtime}`, () => {
      test('fades in and ends at rest, so it can be hovered: nothing is lifted', async ({ page }) => {
        await page.goto(cardUrl(runtime));
        await entranceDone(page, runtime);
        await expect(page.locator(CARD)).toHaveAttribute('data-state', 'rest');
        await expect(stateNow(page)).toHaveText('State: rest');
        await settledPose(page, { lift: 0, scale: 1, opacity: 1 });
      });

      test('is not interactive while the entrance plays, then hover lifts it 4px, press scales it to 98%, leaving returns', async ({ page }) => {
        await page.goto(cardUrl(runtime));
        await entranceDone(page, runtime);
        // Slow the entrance down and replay it, so there is time to try the pointer in the middle of it.
        await page.selectOption('#speed-control', '0.25');
        await page.click('#replay-btn');
        const textOpacity = () => page.evaluate(sel => Number(getComputedStyle(document.querySelector(sel)!).opacity), TEXT);
        await expect.poll(textOpacity, { timeout: 3000 }).toBeLessThan(0.9);
        const box = (await page.locator(CARD).boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(50);
        expect(await textOpacity()).toBeLessThan(1);   // still entering
        await expect(page.locator(CARD)).toHaveAttribute('data-state', 'rest');
        expect((await pose(page)).lift).toBeGreaterThanOrEqual(0);   // not lifted (it is still rising into place, never up past rest)
        // Once it has arrived, a fresh pointer movement lifts it.
        await page.mouse.move(2, 2);
        await page.selectOption('#speed-control', '1');
        await entranceDone(page, runtime);
        await settledPose(page, { lift: 0, opacity: 1 });
        await page.hover(CARD);
        await expect(page.locator(CARD)).toHaveAttribute('data-state', 'hover');
        await settledPose(page, { lift: -4, scale: 1 });
        await page.mouse.down();
        await expect(page.locator(CARD)).toHaveAttribute('data-state', 'pressed');
        await settledPose(page, { lift: -4, scale: 0.98 });
        await page.mouse.up();
        await expect(page.locator(CARD)).toHaveAttribute('data-state', 'hover');
        await settledPose(page, { lift: -4, scale: 1 });
        await page.mouse.move(2, 2);
        await expect(page.locator(CARD)).toHaveAttribute('data-state', 'rest');
        await settledPose(page, { lift: 0, scale: 1, opacity: 1 });
      });

      test('the state buttons still force a state, and the status follows the real events', async ({ page }) => {
        await page.goto(cardUrl(runtime));
        await entranceDone(page, runtime);
        await page.click('[data-state-btn="pressed"]');
        await expect(page.locator(CARD)).toHaveAttribute('data-state', 'pressed');
        await settledPose(page, { lift: -4, scale: 0.98 });
        await page.click('[data-state-btn="rest"]');
        await expect(stateNow(page)).toHaveText(/State: (rest|moving to rest)/);
        await page.hover(CARD);
        await expect(stateNow(page)).toContainText('hover');
      });

      test('Replay plays the entrance again (it fades back in), then hover works again', async ({ page }) => {
        await page.goto(cardUrl(runtime));
        await entranceDone(page, runtime);
        await page.selectOption('#speed-control', '0.25');
        await page.click('#replay-btn');
        await expect.poll(async () => (await pose(page)).opacity, { timeout: 3000 }).toBeLessThan(0.9);
        await page.selectOption('#speed-control', '1');
        await expect.poll(async () => (await pose(page)).opacity, { timeout: 5000 }).toBeGreaterThan(0.999);
        await entranceDone(page, runtime);
        await page.mouse.move(2, 2);
        await page.hover(CARD);
        await expect(page.locator(CARD)).toHaveAttribute('data-state', 'hover');
        await settledPose(page, { lift: -4 });
        await page.mouse.move(2, 2);
        await settledPose(page, { lift: 0, opacity: 1 });
      });
    });
  }

  test('Playback and Tokens used list the entrance first, then the states', async ({ page }) => {
    await page.goto(cardUrl('css'));
    const row = playbackRow(page);
    await expect(row).toContainText('appear: Easing · productive-entrance, 220ms');
    await expect(row).toContainText('title appear: Easing · productive-entrance, 300ms');
    await expect(row).toContainText('into hover: Easing · productive-standard, 220ms');
    await expect(row).toContainText('into rest: Easing · productive-exit, 140ms (authored as a spring; CSS plays its easing)');
    const tokens = page.locator('#tokens-used-list');
    await expect(tokens).toContainText('into hover duration');
    await expect(tokens).toContainText('hover transform');
    await expect(tokens).toContainText('pressed transform');
    await expect(tokens).not.toContainText('image');
  });
});

test.describe('Interactions: Playback and the (switched off) plain-language summary', () => {
  test('card v2 lists how it appears in Playback, and the What it does list is not shown', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(playbackRow(page)).toContainText('appear:');
    // SHOW_WHAT_IT_DOES is off in lab/main.ts: too busy for now. The summary logic stays (unit tests cover it).
    await expect(page.locator('#version-behaviour')).toBeHidden();
    await expect(page.locator('#version-behaviour')).toBeEmpty();
  });
});

// The exported CSS, used the way a developer would: on a plain element, no lab code, only the stylesheet.
test.describe('Interactions: the exported CSS works on its own', () => {
  test('hover and press on a plain element lift it and scale it, after its entrance', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await page.locator('.lab-sidebar > details > summary', { hasText: 'Generated code' }).click();
    const cssText = await page.locator('#css-pre').innerText();
    await page.evaluate(css => {
      const style = document.createElement('style');
      style.textContent = css.replace(/transition-duration: [^;]+;/g, 'transition-duration: 1ms;').replace(/animation-duration: [^;]+;/g, 'animation-duration: 1ms;');
      document.head.appendChild(style);
      const box = document.createElement('div');
      box.id = 'plain';
      box.className = 'motion-card-v2';
      box.style.cssText = 'position:fixed;left:40px;bottom:40px;width:200px;height:100px;background:#ccc;z-index:99999';
      document.body.appendChild(box);
    }, cssText);
    const pose = () => page.evaluate(() => {
      const m = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#plain')!).transform);
      return { lift: +m.m42.toFixed(1), scale: +m.m11.toFixed(2) };
    });
    await expect.poll(pose).toEqual({ lift: 0, scale: 1 });
    await page.hover('#plain');
    await expect.poll(pose).toEqual({ lift: -4, scale: 1 });
    await page.mouse.down();
    await expect.poll(pose).toEqual({ lift: -4, scale: 0.98 });
    await page.mouse.up();
    await page.mouse.move(600, 100);
    await expect.poll(pose).toEqual({ lift: 0, scale: 1 });
  });
});
