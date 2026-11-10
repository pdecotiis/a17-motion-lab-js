import { test, expect, type Page } from '@playwright/test';

// Archive on a component's versions (lab/lib/archived.ts): a small button to the right of each version's label. The dev server's endpoint is
// answered by the test, so a real archived.json is never written. Needs a component with two versions or more (the lab's default).
const ENDPOINT = '**/__lab/version-archive';

async function mock(page: Page, posts: Record<string, unknown>[]): Promise<void> {
  const archived = new Set<string>();
  await page.route(ENDPOINT, route => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { available: true } });
    const body = JSON.parse(req.postData() ?? '{}') as { version: string; archived: boolean };
    posts.push(body);
    if (body.archived) archived.add(body.version); else archived.delete(body.version);
    return route.fulfill({ json: { archived: [...archived] } });
  });
}

test.describe('archiving a version', () => {
  test('Archive sits beside each version, archiving shows a toast and leaves the version in place, disabled, with Unarchive', async ({ page }) => {
    const posts: Record<string, unknown>[] = [];
    await mock(page, posts);
    await page.goto('/?view=component');
    const tabs = page.locator('.lab-version-tab');
    test.skip((await tabs.count()) < 2, 'this component has one version');
    const count = await tabs.count();
    await expect(page.locator('.lab-version-archive')).toHaveCount(count);
    await expect(page.locator('.lab-version-archive').first()).toHaveText('Archive');
    // it is to the right of the version's label
    const tab = (await tabs.nth(1).boundingBox())!;
    const archive = (await page.locator('[data-archive-for]').nth(1).boundingBox())!;
    expect(archive.x).toBeGreaterThanOrEqual(tab.x + tab.width - 1);
    expect(Math.abs(archive.y + archive.height / 2 - (tab.y + tab.height / 2))).toBeLessThan(4);

    const id = await tabs.nth(1).getAttribute('data-version-id');
    await page.locator(`[data-archive-for="${id}"]`).click();
    await expect(page.locator('.lab-toast')).toContainText('Version archived');
    expect(posts[0]).toMatchObject({ version: id, archived: true });
    // it stays where it is, disabled; its button now says Unarchive
    await expect(page.locator(`.lab-version-tab[data-version-id="${id}"]`)).toBeDisabled();
    await expect(page.locator(`.lab-version-tab[data-version-id="${id}"]`)).toHaveClass(/lab-version-tab--archived/);
    await expect(tabs.nth(1)).toHaveAttribute('data-version-id', id!);
    await expect(page.locator(`[data-archive-for="${id}"]`)).toHaveText('Unarchive');

    await page.locator(`[data-archive-for="${id}"]`).click();
    await expect(page.locator('.lab-toast').last()).toContainText('Version unarchived');
    await expect(page.locator(`.lab-version-tab[data-version-id="${id}"]`)).toBeEnabled();
    await expect(page.locator(`[data-archive-for="${id}"]`)).toHaveText('Archive');
  });

  test('archiving the version on screen moves to one still in play', async ({ page }) => {
    const posts: Record<string, unknown>[] = [];
    await mock(page, posts);
    await page.goto('/?view=component&version=v1');
    test.skip((await page.locator('.lab-version-tab').count()) < 2, 'this component has one version');
    await page.locator('[data-archive-for="v1"]').click();
    await expect(page.locator('.lab-toast')).toContainText('Version archived');
    await expect(page).not.toHaveURL(/version=v1(&|$)/);
    await expect(page.locator('.lab-version-tab--active')).not.toHaveAttribute('data-version-id', 'v1');
  });

  test('the last version in play cannot be archived', async ({ page }) => {
    const posts: Record<string, unknown>[] = [];
    await mock(page, posts);
    await page.goto('/?view=component');
    const count = await page.locator('.lab-version-tab').count();
    test.skip(count < 2, 'this component has one version');
    const ids = await page.locator('.lab-version-tab').evaluateAll(els => els.map(e => (e as HTMLElement).dataset['versionId']!));
    for (const id of ids.slice(0, -1)) {
      await page.locator(`[data-archive-for="${id}"]`).click();
      await expect(page.locator(`[data-archive-for="${id}"]`)).toHaveText('Unarchive');
    }
    await expect(page.locator(`[data-archive-for="${ids[ids.length - 1]}"]`)).toBeDisabled();
  });

  test('a refused archive says why', async ({ page }) => {
    await page.route(ENDPOINT, route => route.request().method() === 'GET'
      ? route.fulfill({ json: { available: true } })
      : route.fulfill({ status: 400, json: { error: 'Keep at least one version in play: this is the last one.' } }));
    await page.goto('/?view=component');
    test.skip((await page.locator('.lab-version-tab').count()) < 2, 'this component has one version');
    await page.locator('.lab-version-archive').first().click();
    await expect(page.locator('.lab-toast--error')).toContainText('last one');
  });

  test('a built copy has no endpoint: the buttons are off', async ({ page }) => {
    await page.route(ENDPOINT, route => route.fulfill({ status: 404, body: 'Not found' }));
    await page.goto('/?view=component');
    await expect(page.locator('.lab-version-archive').first()).toBeDisabled();
  });
});
