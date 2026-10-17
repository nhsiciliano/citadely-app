import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionEnv } = await import("@/lib/env");
    assertProductionEnv();
  }

  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    const [Sentry, { getSentryOptions }] = await Promise.all([import("@sentry/nextjs"), import("@/lib/sentry")]);
    Sentry.init(getSentryOptions(dsn));
  }
}

// Reports every server-side error (render, route handler, server action, proxy).
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(error, request, context);
    return;
  }

  const { message, digest } = error as Error & { digest?: string };
  console.error("request error", {
    message,
    digest,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
