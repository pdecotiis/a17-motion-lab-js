import { defineConfig, devices } from '@playwright/test';
import { LAB_E2E_FILES, LAB_TESTS, PRESET_E2E_FILES, SAMPLES_PRESENT, SAMPLE_E2E_FILES, TEMPLATE_PRESETS, TEMPLATE_TOKEN_E2E_FILES, WEBKIT_ALL, WEBKIT_SKIP_FILES } from './tests/samples';

const glob = (files: string[]): string[] => files.map(f => `**/${f.replace('tests/e2e/', '')}`);

// The dev server's port. Set PORT when another checkout's server already holds 5173, e.g.
// `PORT=5200 npm run test:e2e`, so these tests don't reuse that server.
const port = process.env['PORT'] ?? '5173';

// The specs left out of every browser. A project that removed the template's samples skips the specs that need them (tests/samples.ts).
const ignored = [
  '**/_template.spec.ts',
  ...glob([
    ...(SAMPLES_PRESENT ? [] : [...SAMPLE_E2E_FILES, ...TEMPLATE_TOKEN_E2E_FILES]),
    // Specs that pin the template's default presets (tokens/presets.json) are left out when a project customises them.
    ...(TEMPLATE_PRESETS ? [] : PRESET_E2E_FILES),
    // The lab's own specs run in the template; a project runs them with LAB_TESTS=1 (after a merge from the template).
    ...(LAB_TESTS ? [] : LAB_E2E_FILES),
  ]),
];

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ignored,
  // Every test is independent (own page, shared dev server), so run them all in parallel: ~90s down to ~50s.
  fullyParallel: true,
  workers: process.env['CI'] ? 2 : '80%',
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // WebKit runs the motion tests, not the lab's screens, unless WEBKIT_ALL=1 (see tests/samples.ts).
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: [...ignored, ...(WEBKIT_ALL ? [] : glob(WEBKIT_SKIP_FILES))] }, // a project's own testIgnore replaces the global one, so repeat it
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 30000,
  },
});
