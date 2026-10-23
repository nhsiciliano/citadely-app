import type { VercelConfig } from "@vercel/config/v1";

// El plan Hobby de Vercel solo admite crons diarios: cualquier schedule más frecuente hace fallar el deploy
// ("Hobby accounts are limited to daily cron jobs"). transactional-email (cada minuto),
// cancel-expired-deposits (*/10) y failure-alerts (*/15) corren desde schedules de InsForge (ver README,
// sección Crons). La reconciliación diaria de suscripciones se retiró con el producto gratuito.
// Vercel Cron solo corre en producción y envía `Authorization: Bearer $CRON_SECRET` con un GET.
export const config: VercelConfig = {
  crons: [],
};
