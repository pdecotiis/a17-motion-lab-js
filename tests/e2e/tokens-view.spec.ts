import { test, expect } from '@playwright/test';
import { setRuntime } from './lab.js';
import { SAMPLES_PRESENT, SAMPLES_NEEDED } from '../samples.js';

test.describe('Tokens view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=tokens');
  });

  const names = (page: import('@playwright/test').Page) => page.locator('.lab-token-name').allTextContents();
  const open = (page: import('@playwright/test').Page, kind: string) => page.click(`.lab-tokens-subtab:has-text("${kind}")`);

  test('the kinds are duration, easing, distance, scale, opacity and delay; duration opens first', async ({ page }) => {
    await expect(page.locator('.lab-tokens-subtab')).toHaveText(['Duration', 'Easing', 'Distance', 'Scale', 'Opacity', 'Delay']);
    await expect(page.locator('.lab-tokens-subtab--active')).toHaveText('Duration');
  });

  test('each kind has a sub-header, and an easing one per group, as the kit\'s sheets do', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED); // pins the template's easings
    await expect(page.locator('.lab-tokens-group')).toHaveText(['duration']);
    await open(page, 'Easing');
    await expect(page.locator('.lab-tokens-group')).toHaveText(['productive', 'expressive', 'linear']);
    await expect(page.locator('.lab-tokens-table')).toHaveCount(3);
  });

  test('the spacing is the kit\'s: a 160px header, 96px sub-headers, 56px rows, equal columns, 240px curves', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    const height = (selector: string): Promise<number> => page.locator(selector).first().evaluate(e => Math.round(e.getBoundingClientRect().height));
    expect(await height('.lab-tokens-hero')).toBe(160);
    expect(await height('.lab-tokens-group')).toBe(96);
    expect(await height('.lab-tokens-table th')).toBe(56);
    expect(await height('.lab-token-row')).toBe(56);
    const widths = await page.locator('.lab-tokens-table th').evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().width)));
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
    await open(page, 'Easing');
    const curve = await page.locator('.lab-curve').first().boundingBox();
    expect(Math.round(curve!.height)).toBe(240);
    expect(Math.abs((await height('.lab-token-row')) - 268)).toBeLessThanOrEqual(2);
  });

  test('tokens run smallest to largest within each kind', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    expect(await names(page)).toEqual(['50', '100', '150', '200', '250', '400', '700', '1200'].map(n => `duration-${n}`));
    await open(page, 'Distance');
    expect(await names(page)).toEqual(['4', '8', '12', '20', '32', '52', '84', '136'].map(n => `distance-${n}`));
    await open(page, 'Scale');
    expect(await names(page)).toEqual(['90', '95', '100'].map(n => `scale-${n}`));
    await open(page, 'Opacity');
    expect(await names(page)).toEqual(['0', '100'].map(n => `opacity-${n}`));
    await open(page, 'Delay');
    expect(await names(page)).toEqual(['40', '80', '120'].map(n => `delay-${n}`));
  });

  test('token names use hyphens, and an easing drops its group word', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    expect((await names(page))[0]).toBe('duration-50');
    expect((await names(page)).some(n => n.includes('.'))).toBe(false);
    await open(page, 'Easing');
    expect((await names(page)).some(n => n.includes('.') || n.startsWith('easing'))).toBe(false);
  });

  test('easings run in system order', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED); // pins the template's easings
    await open(page, 'Easing');
    expect(await names(page)).toEqual([
      'productive-standard', 'productive-entrance', 'productive-exit',
      'expressive-standard', 'expressive-entrance', 'expressive-exit',
      'linear',
    ]);
  });

  test('the columns are the spec sheet\'s: Token, Value, and an Example where the kind has one', async ({ page }) => {
    await expect(page.locator('.lab-tokens-table th')).toHaveText(['Token', 'Value (ms)', 'Example']);
    await open(page, 'Easing');
    await expect(page.locator('.lab-tokens-table').first().locator('th')).toHaveText(['Token', 'Value', 'Example']);
    await open(page, 'Distance');
    await expect(page.locator('.lab-tokens-table th')).toHaveText(['Token', 'Value (px)', 'Example']);
    await open(page, 'Scale');
    await expect(page.locator('.lab-tokens-table th')).toHaveText(['Token', 'Value (%)']);
    await open(page, 'Opacity');
    await expect(page.locator('.lab-tokens-table th')).toHaveText(['Token', 'Value (%)']);
    await open(page, 'Delay');
    await expect(page.locator('.lab-tokens-table th')).toHaveText(['Token', 'Value (ms)']);
  });

  test('a row is the name, the value and an example: usage, status and notes are in the tooltip', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    await expect(page.locator('.lab-token-used-by, .lab-token-badge, .lab-token-desc')).toHaveCount(0);
    const cells = page.locator('.lab-token-row').first().locator('td');
    await expect(cells.nth(0)).toHaveText('duration-50');
    await expect(cells.nth(1)).toHaveText('50');
    await open(page, 'Easing');
    await expect(page.locator('.lab-token-row').first().locator('td').nth(1)).toHaveText('0.2, 0, 0.38, 0.9');
    await open(page, 'Scale');
    await expect(page.locator('.lab-token-row', { hasText: 'scale-95' }).locator('td').nth(1)).toHaveText('95');
    await open(page, 'Opacity');
    await expect(page.locator('.lab-token-row', { hasText: 'opacity-100' }).locator('td').nth(1)).toHaveText('100');
    await expect(page.locator('.lab-token-row', { hasText: 'opacity-0' }).locator('td').nth(1)).toHaveText('0');
  });

  test('notes, status, value, usage and old names are in the tooltip', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    const tip = (key: string) => page.locator('.lab-token-row', { hasText: key }).first().getAttribute('title');
    const used = await tip('duration-200');
    expect(used).toContain('Path: duration.200');
    expect(used).toContain('Status: system');
    expect(used).toContain('Value: 200ms');
    expect(used).toContain('Old names: 220');
    expect(used).toContain('Used by: card/v1');
    expect(await tip('duration-1200')).toContain('Not used yet');

    await open(page, 'Easing');
    const entrance = await tip('expressive-entrance');
    expect(entrance).toContain('Status: system');
    expect(entrance).toContain('Value: cubic-bezier(0, 0, 0.3, 1)');
    await expect(page.locator('.lab-token-row', { hasText: 'expressive-settle' })).toHaveCount(0);
    await expect(page.locator('.lab-token-row', { hasText: 'expressive-bounce' })).toHaveCount(0);

    // Notes and status show for an experimental token too: the bounce tokens, under Motion.
    await setRuntime(page, 'motion');
    await open(page, 'Bounce');
    const bounce = await tip('bounce-25');
    expect(bounce).toContain("Motion's default bounce");
    expect(bounce).toContain('Status: experimental');
    expect(bounce).toContain('Value: 0.25');
  });

  test('easings have a curve; durations and distances a bar or a square; the rest have no example', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED); // pins the template's easings
    await expect(page.locator('.lab-token-row .lab-curve')).toHaveCount(0);
    await expect(page.locator('.lab-token-row .lab-token-preview')).toHaveCount(8);
    await open(page, 'Easing');
    await expect(page.locator('.lab-token-row .lab-curve')).toHaveCount(7);
    await open(page, 'Distance');
    await expect(page.locator('.lab-token-row .lab-token-preview')).toHaveCount(8);
    await open(page, 'Scale');
    await expect(page.locator('.lab-token-row .lab-curve, .lab-token-row .lab-token-preview')).toHaveCount(0);
  });

  test('a curve is drawn as the kit\'s easing sheet draws it: a dashed box, the straight line, the curve and its two handles', async ({ page }) => {
    await open(page, 'Easing');
    const curve = page.locator('.lab-token-row .lab-curve').first();
    const box = await curve.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(200);
    expect(box!.width).toBeGreaterThanOrEqual(box!.height);
    await expect(curve.locator('.lab-curve__line')).toHaveAttribute('d', /^M/);
    await expect(curve.locator('.lab-curve__box')).toHaveCount(1);
    await expect(curve.locator('.lab-curve__diagonal')).toHaveCount(1);
    await expect(curve.locator('.lab-curve__handle')).toHaveCount(2);
    await expect(curve.locator('.lab-curve__point')).toHaveCount(2);
  });

  test('a bounce curve has no handles: it is a spring, not a bezier', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    await setRuntime(page, 'motion');
    await open(page, 'Bounce');
    const curve = page.locator('.lab-token-row .lab-curve').first();
    await expect(curve.locator('.lab-curve__handle')).toHaveCount(0);
    await expect(curve.locator('.lab-curve__box')).toHaveCount(1);
  });

  test('a duration is a bar as long as it is against the longest, and a distance a square that moves on click', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    const widths = await page.locator('.lab-token-example--duration .lab-token-preview').evaluateAll(els => els.map(e => e.getBoundingClientRect().width));
    expect(widths).toHaveLength(8);
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
    expect(widths[7]! / widths[0]!).toBeGreaterThan(8);
    await open(page, 'Distance');
    const box = page.locator('.lab-token-row', { hasText: 'distance-52' }).locator('.lab-dist-box');
    const before = (await box.boundingBox())!.x;
    await box.click();
    await expect.poll(async () => (await box.boundingBox())!.x).toBeGreaterThan(before + 30);
  });

  test('clicking a curve runs the dot along it', async ({ page }) => {
    await open(page, 'Easing');
    const dot = page.locator('.lab-token-row .lab-curve').first().locator('.lab-curve__dot');
    const before = Number(await dot.getAttribute('cx'));
    await page.locator('.lab-token-row .lab-curve').first().click();
    await expect.poll(async () => Number(await dot.getAttribute('cx'))).toBeGreaterThan(before + 20);
  });

  test('Bounce shows only under Motion: three tokens, each with a spring curve from Motion', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    await page.goto('/?view=tokens');
    await expect(page.locator('.lab-tokens-subtab', { hasText: 'Bounce' })).toHaveCount(0);
    await setRuntime(page, 'motion');
    await open(page, 'Bounce');
    await expect(page.locator('.lab-token-name')).toHaveText(['bounce-0', 'bounce-25', 'bounce-50']);
    await expect(page.locator('#bounce-control')).toHaveValue('bounce.25');
    await expect(page.locator('.lab-tokens-table .lab-curve')).toHaveCount(3);
    const tip = (key: string) => page.locator('.lab-token-row', { hasText: key }).getAttribute('title');
    expect(await tip('bounce-25')).toContain('Used by: the global bounce setting');
    expect(await tip('bounce-50')).toContain('Used by: side-panel/v1');
    await setRuntime(page, 'css');
    await expect(page.locator('.lab-tokens-subtab', { hasText: 'Bounce' })).toHaveCount(0);
  });

  test('the easing view is just easings: no bounce column, no Bounces table, no Easing / Spring switch', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED); // pins the template's easings
    await open(page, 'Easing');
    await expect(page.locator('.lab-tokens-table')).toHaveCount(3);
    await expect(page.locator('.lab-tokens-table').first().locator('th')).toHaveText(['Token', 'Value', 'Example']);
    await expect(page.locator('.lab-tokens-heading')).toHaveCount(0);
    await expect(page.locator('#easing-mode-spring')).toHaveCount(0);
    await expect(page.locator('.lab-tokens-subtab', { hasText: 'Bounce' })).toHaveCount(0);
  });
});
