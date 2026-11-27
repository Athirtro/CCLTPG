import { defineConfig, devices } from '@playwright/test';

const PW_LIBS =
  process.env.CCLTPG_PW_LIBS ?? '/home/athirtro/.local/pw-libs/usr/lib/x86_64-linux-gnu';
const LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
  ? `${process.env.LD_LIBRARY_PATH}:${PW_LIBS}`
  : PW_LIBS;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: '/tmp/opencode/ccltpg-e2e/report', open: 'never' }],
    ['junit', { outputFile: '/tmp/opencode/ccltpg-e2e/junit.xml' }],
  ],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      env: { ...process.env, LD_LIBRARY_PATH } as Record<string, string>,
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
