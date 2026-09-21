import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
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
      command: "pnpm exec next dev --hostname 127.0.0.1 --port 3002",
      env: {
        MERCADOPAGO_ACCESS_TOKEN: "TEST-e2e-access-token",
        MERCADOPAGO_API_BASE_URL: "http://127.0.0.1:3010",
        MERCADOPAGO_PAYER_EMAIL: "payer@testuser.com",
        MERCADOPAGO_WEBHOOK_SECRET: "e2e-webhook-secret",
        RESEND_SKIP_DELIVERY: "true",
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
