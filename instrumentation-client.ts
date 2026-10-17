// Runs in the browser before the app hydrates. Sentry is loaded lazily and only
// when NEXT_PUBLIC_SENTRY_DSN is set, so the default bundle is unaffected.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void Promise.all([import("@sentry/nextjs"), import("@/lib/sentry")]).then(([Sentry, { getSentryOptions }]) => {
    Sentry.init(getSentryOptions(dsn));
  });
}
