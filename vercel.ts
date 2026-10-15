import type { VercelConfig } from "@vercel/config/v1";

// Vercel Cron only runs on production deployments and sends
// `Authorization: Bearer $CRON_SECRET` with a GET request.
export const config: VercelConfig = {
  crons: [
    { path: "/api/cron/transactional-email", schedule: "* * * * *" },
    { path: "/api/cron/cancel-expired-deposits", schedule: "*/10 * * * *" },
    { path: "/api/cron/failure-alerts", schedule: "*/15 * * * *" },
    // Diario a las 06:00 UTC (03:00 en Argentina): re-sincroniza suscripciones y detecta huérfanas.
    { path: "/api/cron/reconcile-subscriptions", schedule: "0 6 * * *" },
  ],
};
