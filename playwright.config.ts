import { defineConfig, devices } from "@playwright/test";
import { loadE2eEnvironment } from "./tests/e2e/support/env";

// The only place that reads .env.local / .insforge/project.json; specs read process.env.
loadE2eEnvironment();

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  globalSetup: "./tests/e2e/support/global-setup.ts",
  globalTeardown: "./tests/e2e/support/global-teardown.ts",
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/fixtures/mercadopago-mock.mjs",
      url: "http://127.0.0.1:3010/checkout/health",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      // Direct node call: does not depend on pnpm being on PATH.
      command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3002",
      env: {
        MERCADOPAGO_ACCESS_TOKEN: "TEST-e2e-access-token",
        MERCADOPAGO_API_BASE_URL: "http://127.0.0.1:3010",
        MERCADOPAGO_PAYER_EMAIL: "payer@testuser.com",
        MERCADOPAGO_WEBHOOK_SECRET: "e2e-webhook-secret",
        VERCEL_AUTOMATION_BYPASS_SECRET: "e2e-vercel-bypass",
        RESEND_SKIP_DELIVERY: "true",
        // Specs write to the database directly; the public page must not serve cached data.
        PUBLIC_PAGE_REVALIDATE_SECONDS: "0",
        CRON_SECRET: "e2e-cron-secret",
      },
      url: "http://127.0.0.1:3002",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
