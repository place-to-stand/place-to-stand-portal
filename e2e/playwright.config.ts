import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests for the internal portal and the client portal, run against a
 * LOCAL app (never production): `npm run test:e2e`.
 *
 *   E2E_BASE_URL    internal portal (default http://localhost:3003)
 *   E2E_PORTAL_URL  client portal   (default http://localhost:3011)
 *   E2E_WRITES=1    also run the tests that change data (use a throwaway
 *                   database, e.g. a rehearsal copy)
 *   E2E_PROD_COPY=1 also run checks that expect the production copy's
 *                   numbers (the September 2026 close)
 *
 * Sign-in uses one-time links from the local Supabase (global-setup.ts),
 * so no password is stored anywhere.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3003'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: path.join(__dirname, 'test-results'),
  globalSetup: './global-setup.ts',
  use: {
    baseURL,
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', storageState: path.join(__dirname, '.auth/admin.json') },
      testIgnore: /sales\.spec|phone\.spec/,
    },
    {
      name: 'sales',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', storageState: path.join(__dirname, '.auth/sales.json') },
      testMatch: /sales\.spec/,
    },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], channel: 'chrome', storageState: path.join(__dirname, '.auth/admin.json') },
      testMatch: /phone\.spec/,
    },
  ],
})
