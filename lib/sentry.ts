import type { NodeOptions } from "@sentry/nextjs";

/**
 * Shared Sentry options. Sentry is opt-in: nothing is imported or initialised
 * unless SENTRY_DSN (server) / NEXT_PUBLIC_SENTRY_DSN (browser) is set.
 */
export function getSentryOptions(dsn: string): NodeOptions {
  return {
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    // Bookings carry client names, emails and phones, and requests carry auth cookies:
    // Sentry 11 collects headers, cookies and bodies by default, so opt out explicitly.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
  };
}
