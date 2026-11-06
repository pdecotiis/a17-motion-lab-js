import { test, expect, type Page } from '@playwright/test';

// The Presets view: each entrance preset playing on an example.
// A preset is up to two tracks on the same element: the fade (opacity) and the move (rise, scale).
const NAMES = ['eyebrow', 'title', 'text', 'card', 'media', 'ui'];
const holder = (page: Page, name: string) => page.locator(`[data-preset="${name}"] .lab-preset__holder`);

type Pose = { opacity: number; y: number; scale: number };
const pose = (page: Page, name: string): Promise<Pose> => holder(page, name).evaluate(el => {
  const cs = getComputedStyle(el);
  const m = new DOMMatrixReadOnly(cs.transform);
  return { opacity: +Number(cs.opacity).toFixed(3), y: +m.m42.toFixed(2), scale: +m.m11.toFixed(3) };
});

// Samples the pose every frame for `ms`, starting now.
const samples = (page: Page, name: string, ms: number) => holder(page, name).evaluate(async (el, ms) => {
  const out: { t: number; opacity: number; y: number; scale: number }[] = [];
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    const cs = getComputedStyle(el);
    const m = new DOMMatrixReadOnly(cs.transform);
    out.push({ t: performance.now() - t0, opacity: Number(cs.opacity), y: m.m42, scale: m.m11 });
    await new Promise(requestAnimationFrame);
  }
  return out;
}, ms);

const settled = (page: Page, name: string) => expect.poll(() => pose(page, name), { timeout: 4000 }).toEqual({ opacity: 1, y: 0, scale: 1 });

test.describe('Presets view', () => {
  test('the nav has a Presets button, active on the view, and the cards are in order', async ({ page }) => {
    await page.goto('/?view=presets');
    const nav = page.locator('.lab-nav__btn[data-view="presets"]');
    await expect(nav).toHaveText('Presets');
    await expect(nav).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.lab-nav__btn[data-view="tokens"]')).not.toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-preset]')).toHaveCount(6);
    expect(await page.locator('[data-preset]').evaluateAll(els => els.map(e => (e as HTMLElement).dataset['preset']))).toEqual(NAMES);
  });

  test('the nav button opens the view', async ({ page }) => {
    await page.goto('/?view=tokens');
    await page.click('.lab-nav__btn[data-view="presets"]');
    await expect(page).toHaveURL(/view=presets/);
    await expect(page.locator('#presets-grid')).toBeVisible();
  });

  test('each card is just the example and a Replay button', async ({ page }) => {
    await page.goto('/?view=presets');
    for (const name of NAMES) {
      await expect(page.locator(`[data-preset="${name}"] .lab-preset__holder`)).toBeVisible();
      await expect(page.locator(`[data-replay="${name}"]`)).toBeVisible();
      await expect(page.locator(`[data-preset="${name}"] dl`)).toHaveCount(0);
    }
  });

  for (const runtime of ['css', 'motion'] as const) {
    test(`no console errors under ${runtime}, and every preset settles at rest`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', err => errors.push(err.message));
      await page.goto(`/?view=presets&runtime=${runtime}`);
      for (const name of NAMES) await settled(page, name);
      expect(errors).toHaveLength(0);
    });
  }

  test('Replay plays the card as two tracks: fade done by ~350ms, move still settling, then at rest', async ({ page }) => {
    await page.goto('/?view=presets');
    await settled(page, 'card');
    // Start sampling in the same task as the click so the first frame is the start of the motion.
    await page.evaluate(() => document.querySelector<HTMLElement>('[data-replay="card"]')!.click());
    const frames = await samples(page, 'card', 1000);

    const first = frames[0]!;
    expect(first.opacity).toBeLessThan(0.5);
    expect(first.y).toBeGreaterThan(10); // rising from 24px below
    expect(first.scale).toBeLessThan(0.99); // from 0.95

    // Around 350ms the fade (300ms) is done while the move (560ms) is still settling.
    const near = frames.filter(f => f.t >= 340 && f.t <= 420);
    expect(near.length).toBeGreaterThan(0);
    for (const f of near) {
      expect(f.opacity).toBeGreaterThan(0.99);
      expect(f.y).toBeGreaterThan(0.05);
    }

    // By the end the transform is back to identity.
    const last = frames[frames.length - 1]!;
    expect(last.opacity).toBe(1);
    expect(Math.abs(last.y)).toBeLessThan(0.01);
    expect(Math.abs(last.scale - 1)).toBeLessThan(0.001);
  });

  test('Replay restarts a preset that already settled (opacity drops back, then returns)', async ({ page }) => {
    await page.goto('/?view=presets&runtime=motion');
    await settled(page, 'title');
    await page.locator('[data-replay="title"]').click();
    await expect.poll(async () => (await pose(page, 'title')).opacity, { timeout: 2000 }).toBeLessThan(0.99);
    await settled(page, 'title');
  });

  test('Replay all replays every preset', async ({ page }) => {
    await page.goto('/?view=presets');
    for (const name of NAMES) await settled(page, name);
    // Sample every holder together right after the click (the quickest preset, ui, fades in 100ms, so polling them one by one is flaky)
    const lows = await page.evaluate(async () => {
      const els = [...document.querySelectorAll<HTMLElement>('.lab-preset__holder')];
      const min = els.map(() => 1);
      document.querySelector<HTMLElement>('#presets-replay-all')!.click();
      const t0 = performance.now();
      while (performance.now() - t0 < 80) {
        els.forEach((el, i) => { min[i] = Math.min(min[i]!, +getComputedStyle(el).opacity); });
        await new Promise(requestAnimationFrame);
      }
      return min;
    });
    expect(lows).toHaveLength(NAMES.length);
    for (const low of lows) expect(low).toBeLessThan(0.99);
    for (const name of NAMES) await settled(page, name);
  });

  test('reduced motion: replay has no movement or scale', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?view=presets');
    await settled(page, 'card');
    await page.evaluate(() => document.querySelector<HTMLElement>('[data-replay="card"]')!.click());
    const frames = await samples(page, 'card', 500);
    for (const f of frames) {
      expect(Math.abs(f.y)).toBeLessThan(0.01);
      expect(Math.abs(f.scale - 1)).toBeLessThan(0.001);
    }
    await settled(page, 'card');
  });

  // A move track has no opacity, so under reduced motion it does not play and only the fade does.
  test('reduced motion: replay fades (opacity goes below 1, then returns)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?view=presets');
    await settled(page, 'card');
    await page.evaluate(() => document.querySelector<HTMLElement>('[data-replay="card"]')!.click());
    const frames = await samples(page, 'card', 500);
    expect(Math.min(...frames.map(f => f.opacity))).toBeLessThan(0.99);
    await settled(page, 'card');
  });
});

// The Presets page follows the other views: one primary button, the recipe off the cards, 16px names.
test.describe('Presets page', () => {
  test('Replay all is the page\'s one primary (black) button, and the cards\' Replay buttons are the lighter ones', async ({ page }) => {
    await page.goto('/?view=presets');
    await expect(page.locator('.lab-btn--primary:visible')).toHaveCount(1);
    await expect(page.locator('#presets-replay-all')).toHaveClass(/lab-btn--primary/);
    await expect(page.locator('#presets-replay-all')).toHaveText('Replay all');
    await expect.poll(() => page.locator('#presets-replay-all').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(23, 23, 23)');
    await expect(page.locator('[data-replay]').first()).not.toHaveClass(/lab-btn--primary/);
  });

  test('the cards do not print the recipe: it is the tooltip on the name', async ({ page }) => {
    await page.goto('/?view=presets');
    await expect(page.locator('.lab-preset__recipe')).toHaveCount(0);
    const first = page.locator('.lab-preset__name').first();
    await expect(first).toHaveAttribute('title', /rise .*move .*duration/);
    // nothing on a card but the name, its Replay and the example
    const text = (await page.locator('.lab-preset').first().innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/rise |move |fade /);
  });

  test('the names are 16px, the kit\'s large label', async ({ page }) => {
    await page.goto('/?view=presets');
    expect(await page.locator('.lab-preset__name').first().evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
    expect(await page.locator('.lab-presets__lead').evaluate(el => getComputedStyle(el).fontSize)).toBe('16px');
  });

  test('the top bar has what the page is on the left and Replay all on the right, as the other views do', async ({ page }) => {
    await page.goto('/?view=presets');
    const lead = (await page.locator('.lab-presets__lead').boundingBox())!;
    const button = (await page.locator('#presets-replay-all').boundingBox())!;
    expect(lead.x).toBeLessThan(button.x);
    await expect(page.locator('.lab-viewbar')).toHaveCount(1);
  });

  test('the cards are surfaces on the page colour, with the example on the lighter canvas', async ({ page }) => {
    await page.goto('/?view=presets');
    const colours = await page.evaluate(() => {
      const bg = (sel: string) => getComputedStyle(document.querySelector(sel)!).backgroundColor;
      return { card: bg('.lab-preset'), stage: bg('.lab-preset__stage'), page: getComputedStyle(document.body).backgroundColor };
    });
    expect(colours.card).toBe('rgb(255, 255, 255)');
    expect(colours.stage).toBe(colours.page);
  });
});
