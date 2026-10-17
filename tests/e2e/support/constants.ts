// Secrets of the throwaway dev server the suite starts (playwright.config.ts webServer env). They are constants,
// not read from process.env: the developer's .env.local holds real Preview values for the same variable names.
export const E2E_CRON_SECRET = "e2e-cron-secret";
export const E2E_MERCADOPAGO_WEBHOOK_SECRET = "e2e-webhook-secret";
export const E2E_VERCEL_BYPASS_SECRET = "e2e-vercel-bypass";
