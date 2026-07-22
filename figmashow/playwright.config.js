import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.FIGMASHOW_E2E_BASE || 'http://127.0.0.1:18080',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && node scripts/e2e-server.mjs',
    url: 'http://127.0.0.1:18080/api/health',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
