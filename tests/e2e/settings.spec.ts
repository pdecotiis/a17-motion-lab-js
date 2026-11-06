import { test, expect, type Page } from '@playwright/test';
import { SAMPLES_PRESENT, SAMPLES_NEEDED } from '../samples.js';

// Settings: the gear beside the theme toggle opens a dialog with the things you change rarely. Today
// that is the Global scale: how the distance, duration, delay, opacity and scale tokens get their
// values.
// A safety net: the dev server these tests run against is the real one, so a click that was meant to
// be answered by a test's own mock must never reach it. Any apply that is not a dry run is refused
// here, before the test registers its mock (a later route wins over this one).
test.beforeEach(async ({ page }) => {
  await page.route('**/__lab/scale', route => {
    const req = route.request();
    if (req.method() === 'POST' && req.postDataJSON()?.dryRun !== true) return route.abort();
    return route.continue();
  });
});

const dialog = (page: Page) => page.locator('#settings-dialog');
const openSettings = async (page: Page) => {
  await page.click('#settings-btn');
  await expect(dialog(page)).toBeVisible();
};

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
  });

  test('the gear sits in the top nav beside the theme toggle, and opens the settings', async ({ page }) => {
    const buttons = page.locator('.lab-header__controls > button');
    await expect(buttons).toHaveText(['⚙', '☀']);
    await expect(page.locator('#settings-btn')).toHaveAttribute('aria-label', 'Settings');
    await expect(dialog(page)).toBeHidden();
    await openSettings(page);
    await expect(page.locator('#settings-title')).toHaveText('Settings');
    await expect(page.locator('#settings-scale-title')).toHaveText('Global scale');
  });

  test('closes with the close button, with Escape and with a click outside', async ({ page }) => {
    await openSettings(page);
    await page.click('#settings-close');
    await expect(dialog(page)).toBeHidden();
    await openSettings(page);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await openSettings(page);
    await page.mouse.click(4, 4);
    await expect(dialog(page)).toBeHidden();
  });

  test('is on every view, not only the Tokens view', async ({ page }) => {
    for (const view of ['library', 'page', 'tokens']) {
      await page.goto(`/?view=${view}`);
      await expect(page.locator('#settings-btn')).toBeVisible();
    }
    await expect(page.locator('.lab-tokens-subtab', { hasText: 'Global scale' })).toHaveCount(0);
  });

  test('previews a scale against the current tokens, and says how to apply it', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    await openSettings(page);
    await expect(page.locator('#scale-current')).toHaveText('The tokens follow: distance Fibonacci, delay Fibonacci.');
    await expect(page.locator('#scale-preview-select option')).toHaveText([
      'Minor third (1.2 (6:5))', 'Major third (1.25 (5:4))', 'Perfect fourth (1.333 (4:3))', 'Golden ratio (1.618: wide steps)', 'Fibonacci (1, 2, 3, 5, 8… times the base)',
    ]);
    // the token count is the file's; how many version files change depends on the project's components
    await expect(page.locator('#scale-summary')).toHaveText(/^Major third would rename \d+ tokens and change \d+ version files\.$/);
    await expect(page.locator('.lab-scale-table')).toHaveCount(5);
    await expect(page.locator('.lab-scale-table[data-kind="distance"] tbody tr')).toHaveCount(8);
    await expect(page.locator('#scale-command')).toHaveText('npm run tokens:scale -- --all major-third');

    const row = page.locator('.lab-scale-table[data-kind="distance"] tbody tr', { hasText: 'distance.20' });
    await expect(row.locator('td').nth(1)).toContainText('distance.8');
    await expect(row.locator('td').nth(2)).toContainText('card/v1');
    await expect(row).toHaveClass(/lab-scale-row--renamed/);
  });

  test('another scale changes the preview and the command; the real tokens are untouched', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    await openSettings(page);
    await page.selectOption('#scale-preview-select', 'golden-ratio');
    await expect(page.locator('#scale-summary')).toContainText('Golden ratio would rename');
    await expect(page.locator('#scale-command')).toHaveText('npm run tokens:scale -- --all golden-ratio');
    const row = page.locator('.lab-scale-table[data-kind="distance"] tbody tr', { hasText: 'distance.20' });
    await expect(row.locator('td').nth(1)).toContainText('distance.17');
    await page.click('#settings-close');
    await page.goto('/?view=tokens');
    await page.click('.lab-tokens-subtab:has-text("Distance")');
    await expect(page.locator('.lab-token-name')).toHaveText(['4', '8', '12', '20', '32', '52', '84', '136'].map(n => `distance-${n}`));
  });

  test('the changes can be folded away, since the summary is often enough', async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('#scale-changes')).toHaveAttribute('open', '');
    await page.locator('#scale-changes > summary').click();
    await expect(page.locator('.lab-scale-table').first()).toBeHidden();
    await expect(page.locator('#scale-summary')).toBeVisible();
  });
});

// The Apply button writes the tokens through the dev server. These tests answer the server's POST
// themselves, so no test ever rewrites the real token file.
const mockApply = async (page: Page, reply: { status: number; body: unknown }) => {
  const posts: unknown[] = [];
  await page.route('**/__lab/scale', route => {
    if (route.request().method() !== 'POST') return route.continue();
    posts.push(route.request().postDataJSON());
    return route.fulfill({ status: reply.status, contentType: 'application/json', body: JSON.stringify(reply.body) });
  });
  return posts;
};

test.describe('Settings: apply a scale', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?view=component&component=card&version=v1');
  });

  test('Apply is enabled with the dev server, and asks before it does anything', async ({ page }) => {
    await openSettings(page);
    await expect(page.locator('#scale-apply-btn')).toBeEnabled();
    await expect(page.locator('#scale-apply-btn')).toHaveText('Apply Major third');
    await expect(page.locator('#scale-apply-note')).toContainText('Save your work first');
    await page.click('#scale-apply-btn');
    await expect(page.locator('#scale-apply-note')).toContainText(/renames \d+ tokens in tokens\/motion\.json and edits \d+ version files/);
    await expect(page.locator('#scale-apply-confirm')).toBeVisible();
    await page.click('#scale-apply-cancel');
    await expect(page.locator('#scale-apply-btn')).toBeVisible();
    await expect(page.locator('#scale-apply-confirm')).toHaveCount(0);
  });

  test('confirming sends the chosen scale, then reloads with the settings open and says what happened', async ({ page }) => {
    const posts = await mockApply(page, { status: 200, body: { scale: 'golden-ratio', renamed: 29, versionFiles: Array.from({ length: 7 }, (_, i) => `components/c/versions/v${i}.ts`) } });
    await openSettings(page);
    await page.selectOption('#scale-preview-select', 'golden-ratio');
    await expect(page.locator('#scale-apply-btn')).toHaveText('Apply Golden ratio');
    await page.click('#scale-apply-btn');
    await page.click('#scale-apply-confirm');
    await expect(page.locator('#scale-apply-result')).toHaveText('Applied. Reloading…');
    expect(posts).toEqual([{ scale: 'golden-ratio' }]);
    // after the reload the settings are open again, with the outcome on them
    await expect(page.locator('#scale-flash')).toHaveText('Applied Golden ratio: 29 tokens renamed, 7 version files updated.', { timeout: 5000 });
    await expect(dialog(page)).toBeVisible();
    // shown once
    await page.reload();
    await expect(dialog(page)).toBeHidden();
    await openSettings(page);
    await expect(page.locator('#scale-flash')).toHaveCount(0);
  });

  test('when the server refuses, the reason shows and the buttons come back', async ({ page }) => {
    await mockApply(page, { status: 400, body: { error: 'boom: two steps collide' } });
    await openSettings(page);
    await page.click('#scale-apply-btn');
    await page.click('#scale-apply-confirm');
    await expect(page.locator('#scale-apply-result')).toHaveText('Could not apply: boom: two steps collide');
    await expect(page.locator('#scale-apply-confirm')).toBeEnabled();
    await expect(page.locator('#scale-apply-cancel')).toBeEnabled();
  });

  test('without a dev server (a built copy) the button is off and the command is the way', async ({ page }) => {
    await page.route('**/__lab/scale', route => route.fulfill({ status: 404, body: 'Not found' }));
    await openSettings(page);
    await expect(page.locator('#scale-apply-btn')).toBeDisabled();
    await expect(page.locator('#scale-apply-note')).toContainText('Applying needs the dev server (npm run dev)');
    await expect(page.locator('#scale-command')).toHaveText('npm run tokens:scale -- --all major-third');
  });

  test('the dev server answers, and a dry run through it writes nothing', async ({ page }) => {
    test.skip(!SAMPLES_PRESENT, SAMPLES_NEEDED);
    const info = await page.request.get('/__lab/scale');
    expect(await info.json()).toEqual({ available: true });
    const res = await page.request.post('/__lab/scale', { data: { scale: 'major-third', dryRun: true } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ scale: 'major-third', dryRun: true, renamed: expect.any(Number) });
    await page.goto('/?view=tokens');
    await page.click('.lab-tokens-subtab:has-text("Distance")');
    await expect(page.locator('.lab-token-name')).toHaveText(['4', '8', '12', '20', '32', '52', '84', '136'].map(n => `distance-${n}`));
  });
});
