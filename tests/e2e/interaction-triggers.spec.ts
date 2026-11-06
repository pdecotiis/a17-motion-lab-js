import { test, expect, type Page } from '@playwright/test';

// The triggers (hover, press, focus, click) wired by the interaction player, on small stand-in elements so
// each event is tested on its own, whatever the real components do. The page is the Lab, used only to load
// the player module; the elements are added to its body.
const SETUP = async (page: Page) => {
  await page.goto('/?view=tokens');
  await page.evaluate(async () => {
    const { createInteractionPlayer } = await import('/lib/interaction-player.ts' as string) as typeof import('../../lab/lib/interaction-player.js');
    const raw = { 'duration.100': '100ms', 'easing.linear': [0, 0, 1, 1] };
    const timing = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.linear' };
    const make = (id: string, top: number, triggers: unknown[], inner = '') => {
      const host = document.createElement('div');
      host.id = id;
      host.style.cssText = `position:fixed;left:20px;top:${top}px;width:160px;height:60px;background:#ddd`;
      host.innerHTML = inner;
      document.body.appendChild(host);
      const version = {
        id: 'v', label: 'v',
        interaction: {
          initial: 'rest',
          states: { rest: { opacity: 1 }, a: { opacity: 0.5 }, b: { opacity: 0.25 } },
          transitions: { rest: timing, a: timing, b: timing },
          triggers,
        },
      };
      const player = createInteractionPlayer(host, version as never, {
        raw, runtime: 'css', globalBounce: 'bounce.25', reducedMotion: () => false, reducedPolicy: 'fade', playbackRate: () => 1,
      });
      const detach = player.attachTriggers();
      (window as unknown as Record<string, unknown>)[`__${id}`] = { player, detach };
    };
    make('hov', 120, [{ on: 'hover', state: 'a' }]);
    make('prs', 200, [{ on: 'press', state: 'b' }, { on: 'hover', state: 'a' }]);
    make('foc', 280, [{ on: 'focus', state: 'a' }], '<button id="focbtn" style="margin:10px">focus me</button><input id="focin" style="margin:10px;width:60px">');
    make('clk', 360, [{ on: 'click', set: 'a' }]);
    make('tog', 440, [{ on: 'click', toggle: ['rest', 'b'] }]);
    make('arw', 600, [{ on: 'arrows', states: ['rest', 'a', 'b'] }]);
    make('lay', 520, [{ on: 'click', target: 'inner', set: 'a' }], '<span data-motion="inner" id="laybtn" style="display:inline-block;margin:10px">layer</span>');
  });
};
const stateOf = (page: Page, id: string) => page.locator(`#${id}`).getAttribute('data-state');

test.describe('Interaction triggers', () => {
  test.beforeEach(async ({ page }) => { await SETUP(page); });

  test('hover goes to the state while the pointer is over it, and back when it leaves', async ({ page }) => {
    expect(await stateOf(page, 'hov')).toBe('rest');
    await page.hover('#hov');
    await expect(page.locator('#hov')).toHaveAttribute('data-state', 'a');
    await page.mouse.move(600, 600);
    await expect(page.locator('#hov')).toHaveAttribute('data-state', 'rest');
  });

  test('a touch has no hover: a touch pointer entering does nothing', async ({ page }) => {
    await page.evaluate(() => document.getElementById('hov')!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' })));
    expect(await stateOf(page, 'hov')).toBe('rest');
    await page.evaluate(() => document.getElementById('hov')!.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'pen' })));
    await expect(page.locator('#hov')).toHaveAttribute('data-state', 'a');
  });

  test('press goes to its state while held, and back to where it was (here, hover) on release', async ({ page }) => {
    await page.hover('#prs');
    await expect(page.locator('#prs')).toHaveAttribute('data-state', 'a');
    await page.mouse.down();
    await expect(page.locator('#prs')).toHaveAttribute('data-state', 'b');
    await page.mouse.up();
    await expect(page.locator('#prs')).toHaveAttribute('data-state', 'a');
    await page.mouse.move(600, 600);
    await expect(page.locator('#prs')).toHaveAttribute('data-state', 'rest');
  });

  test('press released somewhere else still ends', async ({ page }) => {
    await page.hover('#prs');
    await page.mouse.down();
    await expect(page.locator('#prs')).toHaveAttribute('data-state', 'b');
    await page.mouse.move(600, 600);
    await page.mouse.up();
    await expect(page.locator('#prs')).toHaveAttribute('data-state', 'rest');
  });

  test('a right-click does not press', async ({ page }) => {
    await page.hover('#prs');
    await page.mouse.down({ button: 'right' });
    expect(await stateOf(page, 'prs')).toBe('a');
    await page.mouse.up({ button: 'right' });
  });

  test('a mouse click that focuses a button is not a keyboard focus', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Safari does not focus a button on a click, so there is nothing to check');
    await page.click('#focbtn');
    expect(await stateOf(page, 'foc')).toBe('rest');
  });

  test('Tab onto an input inside goes to the focus state, Tab off returns', async ({ page }) => {
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur(); });
    // press Tab until our button has focus (the Lab has controls before it)
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement?.id === 'focin')) break;
    }
    await expect(page.locator('#foc')).toHaveAttribute('data-state', 'a');
    await page.keyboard.press('Tab');
    await expect(page.locator('#foc')).toHaveAttribute('data-state', 'rest');
  });

  test('click sets a state', async ({ page }) => {
    await page.click('#clk');
    await expect(page.locator('#clk')).toHaveAttribute('data-state', 'a');
    await page.click('#clk');
    await expect(page.locator('#clk')).toHaveAttribute('data-state', 'a');
  });

  test('click toggles between two states', async ({ page }) => {
    await page.click('#tog');
    await expect(page.locator('#tog')).toHaveAttribute('data-state', 'b');
    await page.click('#tog');
    await expect(page.locator('#tog')).toHaveAttribute('data-state', 'rest');
    await page.click('#tog');
    await expect(page.locator('#tog')).toHaveAttribute('data-state', 'b');
  });

  test('a trigger on a named layer listens on that layer only', async ({ page }) => {
    await page.click('#lay', { position: { x: 150, y: 50 } });
    expect(await stateOf(page, 'lay')).toBe('rest');
    await page.click('#laybtn');
    await expect(page.locator('#lay')).toHaveAttribute('data-state', 'a');
  });

  test('the arrow keys step through the states, left to right, and stop at the ends', async ({ page }) => {
    expect(await stateOf(page, 'arw')).toBe('rest');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);
    expect(await stateOf(page, 'arw')).toBe('rest'); // nothing before the first
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#arw')).toHaveAttribute('data-state', 'a');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#arw')).toHaveAttribute('data-state', 'b');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    expect(await stateOf(page, 'arw')).toBe('b'); // nothing after the last
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#arw')).toHaveAttribute('data-state', 'a');
  });

  test('the arrow keys are left alone with a modifier, and while typing in a field', async ({ page }) => {
    await page.keyboard.press('Shift+ArrowRight');
    await page.waitForTimeout(200);
    expect(await stateOf(page, 'arw')).toBe('rest');
    await page.locator('#focin').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
    expect(await stateOf(page, 'arw')).toBe('rest');
  });

  test('detaching stops listening', async ({ page }) => {
    await page.evaluate(() => (window as unknown as Record<string, { detach: () => void }>)['__clk']!.detach());
    await page.click('#clk');
    expect(await stateOf(page, 'clk')).toBe('rest');
  });

  test('a trigger whose layer is not in the markup does nothing, and breaks nothing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.evaluate(async () => {
      const { createInteractionPlayer } = await import('/lib/interaction-player.ts' as string) as typeof import('../../lab/lib/interaction-player.js');
      const host = document.createElement('div');
      document.body.appendChild(host);
      const t = { model: 'tween' as const, duration: 'duration.100', easing: 'easing.linear' };
      const p = createInteractionPlayer(host, { id: 'v', label: 'v', interaction: { initial: 'rest', states: { rest: { opacity: 1 }, a: { opacity: 0.5 } }, transitions: { rest: t, a: t }, layers: { ghost: { states: { a: { opacity: 0 } } } }, triggers: [{ on: 'hover', state: 'a', target: 'ghost' }] } } as never, {
        raw: { 'duration.100': '100ms', 'easing.linear': [0, 0, 1, 1] }, runtime: 'css', globalBounce: 'bounce.25', reducedMotion: () => false, reducedPolicy: 'fade', playbackRate: () => 1,
      });
      p.attachTriggers();
      p.goTo('a');
    });
    expect(errors).toEqual([]);
  });
});
