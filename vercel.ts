import type { VercelConfig } from "@vercel/config/v1";

// Vercel Cron only runs on production deployments and sends
// `Authorization: Bearer $CRON_SECRET` with a GET request.
export const config: VercelConfig = {
  crons: [
    { path: "/api/cron/transactional-email", schedule: "* * * * *" },
    { path: "/api/cron/cancel-expired-deposits", schedule: "*/10 * * * *" },
    { path: "/api/cron/failure-alerts", schedule: "*/15 * * * *" },
  ],
};
