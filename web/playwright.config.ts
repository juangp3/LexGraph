import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['json']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    // Add network activity logging
    launchOptions: {
      slowMo: process.env.SLOWMO ? parseInt(process.env.SLOWMO) : 0,
    },
  },

  webServer: {
    command: process.env.WEB_ONLY === 'true' 
      ? 'npm run dev' 
      : 'npm run dev:full',  // Run full stack (backend + frontend)
    env: {
      ...process.env,
      NEXT_PUBLIC_ENABLE_MSW: 'false',
    },
    url: 'http://localhost:3000',
    reuseExistingServer: process.env.CI ? false : true,
    timeout: 120 * 1000,  // 2 minutes for backend startup
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Add Firefox and Safari for broader coverage in CI
    ...(process.env.CI ? [
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
    ] : []),
  ],
});
