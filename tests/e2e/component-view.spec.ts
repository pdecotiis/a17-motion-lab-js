import { test, expect } from '@playwright/test';

test.describe('Component view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
  });

  test('renders the card component', async ({ page }) => {
    await expect(page.locator('.card')).toBeVisible();
  });

  test('switching version tabs changes version URL param', async ({ page }) => {
    await page.click('[data-version-id="v2"]');
    await expect(page).toHaveURL(/version=v2/);
  });

  test('replay button exists and is clickable', async ({ page }) => {
    const replayBtn = page.locator('#replay-btn');
    await expect(replayBtn).toBeVisible();
    await replayBtn.click();
  });

  const timingOf = (page: import('@playwright/test').Page, selector: string) =>
    page.evaluate((sel) => {
      const el = document.querySelector<HTMLElement>(sel)!;
      const anim = el.getAnimations()[0]!;
      const t = (anim.effect as KeyframeEffect).getTiming();
      return { duration: t.duration as number, delay: t.delay as number, rate: anim.playbackRate };
    }, selector);

  test('there are no controls: motion changes are new versions, not tweaks in the component view', async ({ page }) => {
    await expect(page.locator('[aria-label="Live controls"]')).toHaveCount(0);
    for (const id of ['ctrl-duration', 'ctrl-easing', 'ctrl-transform', 'copy-values-btn', 'live-overrides']) {
      await expect(page.locator(`#${id}`)).toHaveCount(0);
    }
  });

  test('a version with layers plays each layer on its element with its own timing', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    const inner = '#preview-inner-primary';
    expect(await timingOf(page, `${inner} [data-motion-target]`)).toMatchObject({ duration: 220, delay: 0 });
    expect(await timingOf(page, `${inner} [data-motion="title"]`)).toMatchObject({ duration: 300, delay: 70 });
    expect(await timingOf(page, `${inner} [data-motion="text"]`)).toMatchObject({ duration: 300, delay: 120 });
  });

  test('replay restarts the layers too, and the speed control reaches them', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.selectOption('#speed-control', '0.25');
    expect((await timingOf(page, '#preview-inner-primary [data-motion="title"]')).rate).toBe(0.25);
    await page.click('#replay-btn');
    const restarted = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('#preview-inner-primary [data-motion="text"]')!;
      return { time: Number(el.getAnimations()[0]!.currentTime), rate: el.getAnimations()[0]!.playbackRate };
    });
    expect(restarted.rate).toBe(0.25);
    expect(restarted.time).toBeLessThan(200);
  });

  test('a version animates the root and each of its layers, and nothing else', async ({ page }) => {
    const inside = await page.evaluate(() => document.querySelector('#preview-inner-primary [data-motion-target]')!.getAnimations({ subtree: true }).length);
    expect(inside).toBe(3);
  });

  test('compare select is present', async ({ page }) => {
    await expect(page.locator('#compare-select')).toBeVisible();
  });
});

test.describe('Component status and lineage', () => {
  test('versions carry no status: no badges on the tabs or in the history, and no status filter', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await expect(page.locator('.lab-version-tab')).toHaveCount(2);
    await expect(page.locator('.lab-sidebar .lab-status-badge')).toHaveCount(0);
    await expect(page.locator('#status-filter')).toHaveCount(0);
    await expect(page.locator('#show-archived')).toHaveCount(0);
  });

  test('the status is the component\'s, in Details; lineage and the version history are shown', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    await expect(page.locator('#version-spec-meta dt:has-text("Component status") + dd')).toHaveText('In progress');
    await expect(page.locator('#version-lineage')).toHaveText('Forked from v1: Fade Up, Text Follows');
    await expect(page.locator('#version-history li')).toHaveCount(2);
    await page.goto('/?view=component&component=card&version=v1');
    await expect(page.locator('#version-lineage')).toHaveText('Kept from the earlier explorations (older versions removed)');
  });

  test('shows when the version plays and what reduced-motion visitors get', async ({ page }) => {
    await page.goto('/?view=component&component=side-panel&version=v1');
    await expect(page.locator('#version-spec-meta')).toContainText('On click');
    await expect(page.locator('#version-spec-meta')).toContainText('Fade only, no movement');

    await page.goto('/?view=component&component=card&version=v1');
    await expect(page.locator('#version-spec-meta')).toContainText('Trigger not specified');
    await page.goto('/?view=component&component=card&version=v2');
    await expect(page.locator('#version-spec-meta')).toContainText('Trigger not specified');
  });

  test('generated CSS is named, token-based and carries a reduced-motion block', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.locator('.lab-sidebar > details > summary', { hasText: 'Generated code' }).click();
    const css = page.locator('#css-pre');
    await expect(css).toContainText('@keyframes motion-card-v1');
    await expect(css).toContainText('var(--motion-duration-220, 220ms)');
    await expect(css).toContainText('translateY(var(--motion-distance-16, 16px))');
    await expect(css).toContainText('@media (prefers-reduced-motion: reduce)');
  });
});

test.describe('Motion map', () => {
  test('lists each version with no status', async ({ page }) => {
    await page.goto('/?view=page&page=home');
    const select = page.locator('#motion-map-panel select').first();
    await expect(select.locator('option[value="v2"]')).toHaveText('v2: Hover Lift');
    await expect(page.locator('#motion-map-panel .lab-status-badge')).toHaveCount(0);
    await expect(page.locator('#motion-map-filter')).toHaveCount(0);
  });
});

test.describe('Sidebar accordions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
  });

  const accordions = (page: import('@playwright/test').Page) => page.locator('.lab-sidebar > details.lab-accordion');
  const summary = (page: import('@playwright/test').Page, title: string) => page.locator('.lab-sidebar > details > summary', { hasText: title });

  test('the panels are accordions, in the order Version, Details, Tokens Used, Version history, Generated code', async ({ page }) => {
    await expect(accordions(page).locator('> summary')).toHaveText(['Version', 'Details', 'Tokens Used', 'Version history', 'Generated code']);
  });

  test('Version, Details and Tokens Used are open by default; Version history and Generated code are closed', async ({ page }) => {
    await expect(accordions(page).nth(0)).toHaveAttribute('open', '');
    await expect(accordions(page).nth(1)).toHaveAttribute('open', '');
    await expect(accordions(page).nth(2)).toHaveAttribute('open', '');
    await expect(accordions(page).nth(3)).not.toHaveAttribute('open', '');
    await expect(accordions(page).nth(4)).not.toHaveAttribute('open', '');
    await expect(page.locator('#version-tabs')).toBeVisible();
    await expect(page.locator('#version-spec-meta')).toBeVisible();
    await expect(page.locator('#tokens-used-list')).toBeVisible();
    await expect(page.locator('#version-history')).toBeHidden();
    await expect(page.locator('#css-pre')).toBeHidden();
  });

  test('clicking a title opens and closes its panel', async ({ page }) => {
    await summary(page, 'Version history').click();
    await expect(page.locator('#version-history')).toBeVisible();
    await expect(page.locator('#version-history li')).toHaveCount(2);
    await summary(page, 'Version history').click();
    await expect(page.locator('#version-history')).toBeHidden();

    await summary(page, 'Generated code').click();
    await expect(page.locator('#css-pre')).toBeVisible();
    await expect(page.locator('#css-pre')).toContainText('@keyframes motion-card-v1');

    await summary(page, 'Tokens Used').click();
    await expect(page.locator('#tokens-used-list')).toBeHidden();
  });

  test('Details holds what it does, then Component status, Plays, Reduced motion and Playback', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v2');
    const details = page.locator('#details-panel');
    await expect(details.locator('#version-behaviour')).toContainText('When you hover over the card');
    await expect(details.locator('#version-spec-meta dt')).toHaveText(['Component status', 'Plays', 'Reduced motion', 'Playback']);
    // The Version panel no longer holds them
    await expect(page.locator('.lab-sidebar > details').first().locator('#version-spec-meta')).toHaveCount(0);
  });

  test('the title can be opened from the keyboard', async ({ page }) => {
    await summary(page, 'Generated code').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#css-pre')).toBeVisible();
  });

  test('Compare with stays a plain panel, always showing its select, after the accordions', async ({ page }) => {
    await expect(page.locator('.lab-sidebar > details')).toHaveCount(5);
    await expect(page.locator('.lab-sidebar > section')).toHaveCount(1);
    await expect(page.locator('.lab-sidebar > section')).toContainText('Compare with');
    await expect(page.locator('#compare-select')).toBeVisible();
    const last = await page.locator('.lab-sidebar > *').last().evaluate(el => el.tagName);
    expect(last).toBe('SECTION');
  });

  test('replay and the version tabs still work from the open Version panel', async ({ page }) => {
    await page.click('#replay-btn');
    await page.click('[data-version-id="v2"]');
    await expect(page).toHaveURL(/version=v2/);
  });
});

// The lab plays with CSS (WAAPI easing curves). It simulates no springs: a version authored as a spring
// plays its from/to values with its easing, and the header has no playback switch.
test.describe('Playback (CSS runtime)', () => {
  const EXPRESSIVE_ENTRANCE = 'cubic-bezier(0, 0, 0.3, 1)';
  const ROOT = '#preview-inner-primary [data-motion-target]';
  const timing = (page: import('@playwright/test').Page, selector: string) =>
    page.evaluate((sel) => {
      const t = (document.querySelector<HTMLElement>(sel)!.getAnimations()[0]!.effect as KeyframeEffect).getTiming();
      return { duration: t.duration as number, easing: t.easing as string };
    }, selector);
  const playbackRow = (page: import('@playwright/test').Page) =>
    page.locator('#version-spec-meta dt:has-text("Playback") + dd');

  test('the header has no Easing / Spring switch', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await expect(page.locator('#play-easing')).toHaveCount(0);
    await expect(page.locator('#play-spring')).toHaveCount(0);
  });

  test('a tween plays its easing curve over its duration', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    expect(await timing(page, ROOT)).toEqual({ duration: 220, easing: 'cubic-bezier(0, 0, 0.38, 0.9)' });
    await expect(playbackRow(page)).toContainText('Easing · productive-entrance, 220ms');
  });

  test('a version authored as a spring plays its easing, and says so', async ({ page }) => {
    await page.goto('/?view=component&component=side-panel&version=v1');
    expect(await timing(page, ROOT)).toEqual({ duration: 560, easing: EXPRESSIVE_ENTRANCE });
    await expect(playbackRow(page)).toContainText('Easing · expressive-entrance, 560ms (authored as a spring; CSS plays its easing)');
  });

  test('layers play their own easing, and the Playback row names each motion', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    for (const sel of [ROOT, '#preview-inner-primary [data-motion="title"]', '#preview-inner-primary [data-motion="text"]']) {
      expect((await timing(page, sel)).easing, sel).toMatch(/^cubic-bezier/);
    }
    await expect(playbackRow(page)).toHaveText([
      'Easing · productive-entrance, 220ms',
      'title: Easing · productive-entrance, 300ms',
      'text: Easing · productive-entrance, 300ms',
    ].join('\n'));
  });

  test('a stale ?play=spring link plays as easing', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1&play=spring');
    expect((await timing(page, ROOT)).easing).toMatch(/^cubic-bezier/);
  });

  test('the page view plays every component with its easing', async ({ page }) => {
    await page.goto('/?view=page&page=home');
    const easings = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-component-id] [data-motion-target]')]
        .map(el => (el.getAnimations()[0]!.effect as KeyframeEffect).getTiming().easing as string));
    expect(easings.length).toBeGreaterThan(0);
    expect(easings.every(e => e.startsWith('cubic-bezier'))).toBe(true);
  });
});

// The runtime switch: CSS (default) plays each version's easing curve; Motion (motion.dev) is a real
// animation library and the only runtime that plays a spring as one.
test.describe('Runtime (CSS / Motion)', () => {
  const ROOT = '#preview-inner-primary [data-motion-target]';
  const playbackRow = (page: import('@playwright/test').Page) =>
    page.locator('#version-spec-meta dt:has-text("Playback") + dd');
  const opacityOf = (page: import('@playwright/test').Page) =>
    page.evaluate((sel) => Number(getComputedStyle(document.querySelector<HTMLElement>(sel)!).opacity), ROOT);

  test('the header has a CSS / Motion switch, CSS by default', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await expect(page.locator('#runtime-css')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#runtime-motion')).toHaveAttribute('aria-pressed', 'false');
  });

  test('under Motion everything plays as a spring: a tween with the global bounce, a spring version with its own', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.click('#runtime-motion');
    await expect(page.locator('#runtime-motion')).toHaveAttribute('aria-pressed', 'true');
    await expect(playbackRow(page)).toContainText('Spring · bounce 0.25 (bounce.25), 220ms (authored as easing; bounce is the global setting)');

    await page.goto('/?view=component&component=side-panel&version=v1&runtime=motion');
    await expect(playbackRow(page)).toContainText('Spring · bounce 0.5 (bounce.50), 560ms');
    await page.click('#runtime-css');
    await expect(playbackRow(page)).toContainText('Easing · expressive-entrance, 560ms (authored as a spring; CSS plays its easing)');
  });

  test('Motion plays the motion: it starts away from the end state and arrives', async ({ page }) => {
    await page.goto('/?view=component&component=side-panel&version=v1&runtime=motion');
    await page.click('#replay-btn');
    await expect.poll(() => opacityOf(page), { timeout: 400 }).toBeLessThan(1);
    await expect.poll(() => opacityOf(page), { timeout: 3000 }).toBe(1);
  });

  test('the speed control reaches Motion too', async ({ page }) => {
    await page.goto('/?view=component&component=side-panel&version=v1&runtime=motion');
    await page.selectOption('#speed-control', '0.25');
    await page.click('#replay-btn');
    await page.waitForTimeout(600);
    expect(await opacityOf(page)).toBeLessThan(1);
  });

  test('the choice is in the URL, and leaves it again under CSS', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.click('#runtime-motion');
    await expect(page).toHaveURL(/runtime=motion/);
    await page.click('#runtime-css');
    await expect(page).not.toHaveURL(/runtime=/);
    const native = await page.evaluate((sel) => document.querySelector<HTMLElement>(sel)!.getAnimations().length, ROOT);
    expect(native).toBe(1);
  });

  test('it holds across the nav and across links between views', async ({ page }) => {
    await page.goto('/?view=library');
    await page.click('#runtime-motion');
    await page.locator('.lab-library-card').first().click();
    await expect(page).toHaveURL(/view=component/);
    await expect(page.locator('#runtime-motion')).toHaveAttribute('aria-pressed', 'true');
    await page.click('.lab-nav__btn[data-view="page"]');
    await expect(page).toHaveURL(/view=page/);
    await expect(page.locator('#runtime-motion')).toHaveAttribute('aria-pressed', 'true');
  });

  test('the global bounce is set in the Tokens view\'s Bounce tab, from the bounce tokens only', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1&runtime=motion');
    await expect(page.locator('#bounce-control')).toHaveCount(0);

    await page.click('.lab-nav__btn[data-view="tokens"]');
    await page.click('.lab-tokens-subtab:has-text("Bounce")');
    await expect(page.locator('#bounce-control')).toHaveValue('bounce.25');
    await expect(page.locator('#bounce-control option')).toHaveText(['bounce.0', 'bounce.25', 'bounce.50']);
    await page.selectOption('#bounce-control', 'bounce.0');
    await expect(page).toHaveURL(/bounce=0/);
    await expect(page.locator('.lab-token-row', { hasText: 'bounce.0' })).toHaveAttribute('title', /Used by: .*the global bounce setting/);
    await expect(page.locator('.lab-token-row', { hasText: 'bounce.25' })).toHaveAttribute('title', /Not used yet/);

    await page.click('.lab-nav__btn[data-view="component"]');
    await expect(playbackRow(page)).toContainText('Spring · bounce 0 (bounce.0), 220ms (authored as easing; bounce is the global setting)');
  });

  test('the global bounce holds across views, and a spring that names its own bounce ignores it', async ({ page }) => {
    await page.goto('/?view=library&runtime=motion&bounce=50');
    await page.locator('.lab-library-card').first().click();
    await expect(page.locator('#version-spec-meta dt:has-text("Playback") + dd')).toContainText('bounce 0.5 (bounce.50)');
    await page.goto('/?view=component&component=side-panel&version=v1&runtime=motion&bounce=0');
    await expect(playbackRow(page)).toContainText('Spring · bounce 0.5 (bounce.50), 560ms');
  });

  test('layers are springs under Motion too, and the Playback row names each motion', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1&runtime=motion');
    const note = ' (authored as easing; bounce is the global setting)';
    await expect(playbackRow(page)).toHaveText([
      `Spring · bounce 0.25 (bounce.25), 220ms${note}`,
      `title: Spring · bounce 0.25 (bounce.25), 300ms${note}`,
      `text: Spring · bounce 0.25 (bounce.25), 300ms${note}`,
    ].join('\n'));
    await expect.poll(() => page.evaluate(() =>
      Number(getComputedStyle(document.querySelector<HTMLElement>('#preview-inner-primary [data-motion="text"]')!).opacity)), { timeout: 3000 }).toBe(1);
  });

  test('exports are as authored whatever the runtime: the CSS is the same', async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
    await page.locator('.lab-sidebar > details > summary', { hasText: 'Generated code' }).click();
    const before = await page.locator('#css-pre').textContent();
    await page.goto('/?view=component&component=card&version=v1&runtime=motion');
    await page.locator('.lab-sidebar > details > summary', { hasText: 'Generated code' }).click();
    expect(await page.locator('#css-pre').textContent()).toBe(before);
  });

  test('a Motion version with no console errors in the library and page views', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    for (const url of ['/?view=library&runtime=motion', '/?view=page&page=home&runtime=motion']) {
      await page.goto(url);
      await page.waitForTimeout(500);
    }
    expect(errors).toEqual([]);
  });
});

// The Generated code panel exports the same version as CSS, GSAP (easing only) or Motion (springs).
test.describe('Export format', () => {
  const open = async (page: import('@playwright/test').Page, url: string) => {
    await page.goto(url);
    await page.locator('.lab-sidebar > details > summary', { hasText: 'Generated code' }).click();
  };

  test('defaults to CSS and offers GSAP and Motion', async ({ page }) => {
    await open(page, '/?view=component&component=card&version=v1');
    await expect(page.locator('#export-format')).toHaveValue('css');
    await expect(page.locator('#export-format option')).toHaveText(['CSS', 'GSAP', 'Motion']);
    await expect(page.locator('#css-pre')).toContainText('@keyframes motion-card-v1');
    await expect(page.locator('#copy-css-btn')).toHaveText('Copy CSS');
  });

  test('GSAP is the same motion as easing code, with the CustomEase for the token', async ({ page }) => {
    await open(page, '/?view=component&component=card&version=v1');
    await page.selectOption('#export-format', 'gsap');
    const pre = page.locator('#css-pre');
    await expect(pre).toContainText('import { gsap } from "gsap";');
    await expect(pre).toContainText('export function playCardV1(el, { index = 0 } = {})');
    await expect(pre).toContainText('CustomEase.create("productive-entrance", "0, 0, 0.38, 0.9"); // easing.productive-entrance');
    await expect(pre).toContainText('duration: 0.22, ease: "productive-entrance"');
    await expect(page.locator('#copy-css-btn')).toHaveText('Copy GSAP');
  });

  test('Motion is the same motion as springs, with the bounce token', async ({ page }) => {
    await open(page, '/?view=component&component=side-panel&version=v1');
    await page.selectOption('#export-format', 'motion');
    const pre = page.locator('#css-pre');
    await expect(pre).toContainText('import { animate } from "motion";');
    await expect(pre).toContainText('type: "spring", visualDuration: 0.56, bounce: 0.5');
    await expect(pre).toContainText('// bounce.50');
    await expect(page.locator('#copy-css-btn')).toHaveText('Copy Motion');
  });

  test('layers become timeline positions in GSAP and their own calls in Motion', async ({ page }) => {
    await open(page, '/?view=component&component=card&version=v1');
    await page.selectOption('#export-format', 'gsap');
    await expect(page.locator('#css-pre')).toContainText('el.querySelectorAll("[data-motion=\\"title\\"]")');
    await page.selectOption('#export-format', 'motion');
    await expect(page.locator('#css-pre')).toContainText('el.querySelectorAll("[data-motion=\\"text\\"]")');
  });

  test('the Motion export follows the global bounce setting, and exports never follow the runtime', async ({ page }) => {
    await open(page, '/?view=component&component=card&version=v1&runtime=motion&bounce=0');
    await page.selectOption('#export-format', 'motion');
    await expect(page.locator('#css-pre')).toContainText('global bounce setting (bounce.0)');
    await page.selectOption('#export-format', 'gsap');
    const underMotion = await page.locator('#css-pre').textContent();
    await page.click('#runtime-css');
    await page.locator('.lab-sidebar > details > summary', { hasText: 'Generated code' }).click();
    await page.selectOption('#export-format', 'gsap');
    expect(await page.locator('#css-pre').textContent()).toBe(underMotion);
  });
});
