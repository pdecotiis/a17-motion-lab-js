import { test, expect, type Page } from '@playwright/test';

// Archive for a whole component, a whole page and a page's versions (lab/lib/archived.ts, scripts/archive-save.ts). The dev server's endpoint is
// answered by the test, so a real archived.json is never written. Runs on the lab's defaults, so it works in a project too.
const ENDPOINT = '**/__lab/archive';

async function mock(page: Page, posts: Record<string, unknown>[]): Promise<void> {
  const versions = new Set<string>();
  await page.route(ENDPOINT, route => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { available: true } });
    const body = JSON.parse(req.postData() ?? '{}') as { kind: string; version?: string; archived: boolean };
    posts.push(body);
    if (body.kind === 'page-version') { if (body.archived) versions.add(body.version!); else versions.delete(body.version!); return route.fulfill({ json: { archived: [...versions] } }); }
    return route.fulfill({ json: { archived: body.archived } });
  });
}

test.describe('archiving a whole component', () => {
  test('Archive in the component view writes through the server, toasts, and the button turns to Unarchive', async ({ page }) => {
    const posts: Record<string, unknown>[] = [];
    await mock(page, posts);
    await page.goto('/?view=component');
    const btn = page.locator('#archive-component-btn');
    await expect(btn).toHaveText('Archive');
    await btn.click();
    await expect(page.locator('.lab-toast')).toContainText('Component archived');
    expect(posts[0]).toMatchObject({ kind: 'component', archived: true });
    await expect(page.locator('#archive-component-btn')).toHaveText('Unarchive');
    await page.locator('#archive-component-btn').click();
    await expect(page.locator('.lab-toast').last()).toContainText('Component unarchived');
    await expect(page.locator('#archive-component-btn')).toHaveText('Archive');
  });
  test('an archived component leaves the Library unless Show archived is on', async ({ page }) => {
    await mock(page, []);
    await page.goto('/?view=component');
    const name = new URL(page.url()).searchParams.get('component') ?? (await page.locator('#breadcrumb-current').textContent())!;
    await page.locator('#archive-component-btn').click();
    await expect(page.locator('#archive-component-btn')).toHaveText('Unarchive');
    await page.locator('#breadcrumb-library').click();
    await expect(page.locator(`.lab-library-card[data-component="${name}"]`)).toHaveCount(0);
    await page.locator('#show-archived').check();
    await expect(page.locator(`.lab-library-card[data-component="${name}"]`)).toHaveCount(1);
  });
  test('a built copy has no endpoint: the button is off', async ({ page }) => {
    await page.route(ENDPOINT, route => route.fulfill({ status: 404, body: 'Not found' }));
    await page.goto('/?view=component');
    await expect(page.locator('#archive-component-btn')).toBeDisabled();
  });
});

test.describe('archiving a whole page', () => {
  test('Archive in the page view; the page leaves the Pages library until Show archived', async ({ page }) => {
    const posts: Record<string, unknown>[] = [];
    await mock(page, posts);
    await page.goto('/?view=page');
    const id = new URL(page.url()).searchParams.get('page') ?? (await page.evaluate(() => document.querySelector('#breadcrumb-pages')?.textContent ?? ''));
    await page.locator('#archive-page-btn').click();
    await expect(page.locator('.lab-toast')).toContainText('Page archived');
    expect(posts[0]).toMatchObject({ kind: 'page', archived: true });
    await expect(page.locator('#archive-page-btn')).toHaveText('Unarchive');
    await page.locator('#breadcrumb-pages').click();
    await expect(page.locator('.lab-library-card[data-page]')).toHaveCount(0);
    await page.locator('#show-archived').check();
    await expect(page).toHaveURL(/archived=1/);
    await expect(page.locator('.lab-library-card[data-page]').first()).toBeVisible();
    expect(id).toBeTruthy();
  });
  test('a built copy has no endpoint: the button is off', async ({ page }) => {
    await page.route(ENDPOINT, route => route.fulfill({ status: 404, body: 'Not found' }));
    await page.goto('/?view=page');
    await expect(page.locator('#archive-page-btn')).toBeDisabled();
  });
});

test.describe('archiving page versions', () => {
  test('an archived version stays listed, disabled, with Unarchive; the one on screen moves; the last cannot be archived', async ({ page }) => {
    const posts: Record<string, unknown>[] = [];
    await mock(page, posts);
    await page.goto('/?view=page&pv=v1');
    const options = page.locator('#page-version-select option');
    const count = await options.count();
    test.skip(count < 2, 'this page has one version');
    await page.locator('[data-archive-page-version="v1"]').click();
    await expect(page.locator('.lab-toast')).toContainText('Version archived');
    expect(posts[0]).toMatchObject({ kind: 'page-version', version: 'v1', archived: true });
    // it stays in the list, disabled, and the view moved to one still in play
    await expect(page.locator('#page-version-select option[value="v1"]')).toBeDisabled();
    await expect(page.locator('#page-version-select option[value="v1"]')).toHaveCount(1);
    await expect(page).not.toHaveURL(/pv=v1(&|$)/);
    await expect(page.locator('#page-compare-select option[value="v1"]')).toBeDisabled();
    // bring it back
    await page.locator('.lab-archive-item', { hasText: 'v1 (archived)' }).locator('button').click();
    await expect(page.locator('.lab-toast').last()).toContainText('Version unarchived');
    await expect(page.locator('#page-version-select option[value="v1"]')).toBeEnabled();
  });
  test('the last page version in play cannot be archived', async ({ page }) => {
    await mock(page, []);
    await page.goto('/?view=page');
    const count = await page.locator('#page-version-select option').count();
    test.skip(count < 2, 'this page has one version');
    for (let i = 0; i < count - 1; i++) {
      const id = await page.locator('#page-version-select').inputValue();
      await page.locator(`[data-archive-page-version="${id}"]`).first().click();
      await expect(page.locator(`#page-version-select option[value="${id}"]`)).toBeDisabled();
    }
    const left = await page.locator('#page-version-select').inputValue();
    await expect(page.locator(`[data-archive-page-version="${left}"]`).first()).toBeDisabled();
  });
});
