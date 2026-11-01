import { defineConfig, devices } from '@playwright/test';

// The dev server's port. Set PORT when another checkout's server already holds 5173, e.g.
// `PORT=5200 npm run test:e2e`, so these tests don't reuse that server.
const port = process.env['PORT'] ?? '5173';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/_template.spec.ts'],
  fullyParallel: false,
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
