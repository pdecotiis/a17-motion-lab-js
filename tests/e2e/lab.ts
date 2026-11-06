import { expect, type Page } from '@playwright/test';

// The motion library (CSS or Motion) is a setting: it lives in the Settings dialog, not the header. Tests that need
// the lab to play with one or the other go through it, as a person would.
export async function setRuntime(page: Page, runtime: 'css' | 'motion'): Promise<void> {
  await page.click('#settings-btn');
  await page.click(`#runtime-${runtime}`);
  await expect(page.locator(`#runtime-${runtime}`)).toHaveAttribute('aria-pressed', 'true');
  await page.click('#settings-close');
}
