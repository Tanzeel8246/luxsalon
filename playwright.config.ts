import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:   './__tests__/e2e',
  timeout:   30 * 1000,
  fullyParallel: false,   // Avoid race conditions with shared test data
  retries:   process.env.CI ? 2 : 0,
  workers:   process.env.CI ? 1 : 2,

  reporter: [
    ['html',  { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL:      process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace:        'on-first-retry',
    screenshot:   'only-on-failure',
    video:        'on-first-retry',
    actionTimeout: 15000,
  },

  projects: [
    {
      name:  'chromium',
      use:   { ...devices['Desktop Chrome'] },
    },
    {
      name:  'mobile-chrome',
      use:   { ...devices['Pixel 5'] },
    },
  ],

  // Start dev server automatically for local testing
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url:     'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
})
