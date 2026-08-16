import { defineConfig, devices } from '@playwright/test';

/** Runs against the already-running dev servers (admin :3001, landing :3002,
 * api :4100) rather than auto-starting them — this suite spans two app
 * origins in one flow, which doesn't fit Playwright's single-`webServer`
 * config cleanly, and the servers are already part of this project's normal
 * local dev workflow (`pnpm --filter admin dev` / `pnpm --filter landing dev`). */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
