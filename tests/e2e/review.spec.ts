import { test, expect, type Page } from '@playwright/test';

// Ready for review (lab/lib/review.ts, scripts/review-save.ts): mark a saved page version, see it on the Pages library's For review list, copy links.
// The dev server's endpoint is answered by the test, so a real review.json is never written. Runs on the lab's defaults.
const ENDPOINT = '**/__lab/review';

async function mock(page: Page, posts: Record<string, unknown>[]): Promise<void> {
  const marked = new Set<string>();
  await page.route(ENDPOINT, route => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { available: true } });
    const body = JSON.parse(req.postData() ?? '{}') as { version: string; ready: boolean };
    posts.push(body);
    if (body.ready) marked.add(body.version); else marked.delete(body.version);
    return route.fulfill({ json: { marked: [...marked] } });
  });
  await page.addInitScript(() => {
    (window as unknown as { __copied: string[] }).__copied = [];
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t: string) => { (window as unknown as { __copied: string[] }).__copied.push(t); return Promise.resolve(); } }, configurable: true });
  });
}

test('with nothing marked the Pages library has no For review toggle', async ({ page }) => {
  await mock(page, []);
  await page.goto('/?view=pages');
  await expect(page.locator('#pages-grid')).toBeVisible();
  test.skip(await page.locator('#review-toggle').isVisible(), 'this project already has versions marked');
  await expect(page.locator('#review-toggle')).toBeHidden();
});

test('mark a page version, find it on the For review list, copy its link, take it off', async ({ page }) => {
  const posts: Record<string, unknown>[] = [];
  await mock(page, posts);
  await page.goto('/?view=page');
  const hasSaved = (await page.locator('#page-version-select option').count()) > 0 && (await page.locator('#review-text').textContent())?.includes('not saved') === false;
  test.skip(!hasSaved, 'this page has no saved version');
  await page.locator('#archive-panel > summary').click();
  test.skip((await page.locator('#archive-page-btn').textContent()) === 'Unarchive page', 'this page is archived, so it is not on the For review list');
  await page.locator('#archive-panel > summary').click();
  const version = await page.locator('#page-version-select').inputValue();
  await page.locator('#review-panel > summary').click();
  test.skip((await page.locator('#review-btn').getAttribute('data-ready')) === 'true', 'this version is already marked');
  await page.locator('#review-btn').click();
  await expect(page.locator('.lab-toast')).toContainText('Marked ready for review');
  expect(posts[0]).toMatchObject({ version, ready: true });
  await expect(page.locator('#review-btn')).toHaveText('Take off review list');

  await page.locator('#breadcrumb-pages').click();
  await expect(page.locator('#review-toggle')).toBeVisible();
  await page.locator('#review-toggle').click();
  await expect(page).toHaveURL(/review=1/);
  const row = page.locator(`.lab-review-card[data-review-version="${version}"]`);
  await expect(row).toHaveCount(1);
  await expect(row.locator('a').first()).toHaveAttribute('href', new RegExp(`pv=${version}&preview=1`));

  await expect(row.locator('.lab-status-badge')).toHaveText('For review');
  await row.locator('[data-copy-review]').click();
  await page.locator('#review-copy-all').click();
  const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
  expect(copied[0]).toContain(`pv=${version}&preview=1`);
  expect(copied[1]).toMatch(/^Ready for review/);

  await row.locator('[data-unmark-review]').click();
  await expect(page.locator('.lab-toast').last()).toContainText('Taken off');
  expect(posts[1]).toMatchObject({ version, ready: false });
  await expect(row).toHaveCount(0);
});

test('a built copy has no endpoint: the buttons are off', async ({ page }) => {
  await page.route(ENDPOINT, route => route.fulfill({ status: 404, body: 'Not found' }));
  await page.goto('/?view=page');
  await page.locator('#review-panel > summary').click();
  await expect(page.locator('#review-btn')).toBeDisabled();
});
