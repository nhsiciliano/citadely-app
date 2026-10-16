import type { VercelConfig } from "@vercel/config/v1";

// El plan Hobby de Vercel solo admite crons diarios: cualquier schedule más frecuente hace fallar el deploy
// ("Hobby accounts are limited to daily cron jobs"). Por eso acá queda solo el diario; transactional-email
// (cada minuto), cancel-expired-deposits (*/10) y failure-alerts (*/15) corren desde schedules de InsForge
// (ver README, sección Crons).
// Vercel Cron solo corre en producción y envía `Authorization: Bearer $CRON_SECRET` con un GET.
export const config: VercelConfig = {
  crons: [
    // Diario a las 06:00 UTC (03:00 en Argentina): re-sincroniza suscripciones y detecta huérfanas.
    { path: "/api/cron/reconcile-subscriptions", schedule: "0 6 * * *" },
  ],
};
