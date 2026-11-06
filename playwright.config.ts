import { defineConfig, devices } from '@playwright/test';
import { PRESET_E2E_FILES, SAMPLES_PRESENT, SAMPLE_E2E_FILES, TEMPLATE_PRESETS, TEMPLATE_TOKEN_E2E_FILES } from './tests/samples';

// The dev server's port. Set PORT when another checkout's server already holds 5173, e.g.
// `PORT=5200 npm run test:e2e`, so these tests don't reuse that server.
const port = process.env['PORT'] ?? '5173';

export default defineConfig({
  testDir: './tests/e2e',
  // A project that removed the template's samples skips the specs that need them (tests/samples.ts).
  testIgnore: [
    '**/_template.spec.ts',
    ...(SAMPLES_PRESENT ? [] : [...SAMPLE_E2E_FILES, ...TEMPLATE_TOKEN_E2E_FILES]),
    // Specs that pin the template's default presets (tokens/presets.json) are left out when a project customises them.
    ...(TEMPLATE_PRESETS ? [] : PRESET_E2E_FILES),
  ].map(f => `**/${f.replace('tests/e2e/', '')}`),
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
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 30000,
  },
});
