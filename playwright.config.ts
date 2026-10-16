import { defineConfig, devices } from "@playwright/test";
import { E2E_CRON_SECRET, E2E_MERCADOPAGO_WEBHOOK_SECRET, E2E_VERCEL_BYPASS_SECRET } from "./tests/e2e/support/constants";
import { loadE2eEnvironment } from "./tests/e2e/support/env";

// The only place that reads .env.local / .insforge/project.json; specs read process.env.
loadE2eEnvironment();

// These specs move the demo business through trialing, active and past_due (an overdue subscription is read-only by
// RLS and hides its public page), so none of them may run while another spec uses that business, nor together.
// Each one is its own project in a chain: `chromium` (everything else) runs first, then subscription-plans, then
// subscription-mercadopago. If a spec fails Playwright reports the later projects as "did not run"; force one with
// `playwright test --project=subscription-mercadopago --no-deps`.
const SUBSCRIPTION_STATE_SPECS = [
  { name: "subscription-plans", match: /subscription-plans\.spec\.ts$/ },
  { name: "subscription-mercadopago", match: /subscription-mercadopago\.spec\.ts$/ },
];

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
        MERCADOPAGO_WEBHOOK_SECRET: E2E_MERCADOPAGO_WEBHOOK_SECRET,
        VERCEL_AUTOMATION_BYPASS_SECRET: E2E_VERCEL_BYPASS_SECRET,
        RESEND_SKIP_DELIVERY: "true",
        // Specs write to the database directly; the public page must not serve cached data.
        PUBLIC_PAGE_REVALIDATE_SECONDS: "0",
        // Every spec books from 127.0.0.1: skip the per-IP bucket of the public booking limiter (email and business limits stay).
        PUBLIC_BOOKING_SKIP_IP_LIMIT: "true",
        CRON_SECRET: E2E_CRON_SECRET,
      },
      url: "http://127.0.0.1:3002",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      testIgnore: SUBSCRIPTION_STATE_SPECS.map((spec) => spec.match),
      use: { ...devices["Desktop Chrome"] },
    },
    ...SUBSCRIPTION_STATE_SPECS.map((spec, index) => ({
      name: spec.name,
      testMatch: spec.match,
      dependencies: [index === 0 ? "chromium" : SUBSCRIPTION_STATE_SPECS[index - 1].name],
      use: { ...devices["Desktop Chrome"] },
    })),
  ],
});
