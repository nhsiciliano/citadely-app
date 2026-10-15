import type { InsForgeClient } from "@insforge/sdk";
import type { SubscriptionPlanId } from "@/lib/subscription-plans";

// Estado de acceso calculado por la RPC get_business_access_state: la misma lógica que aplican
// las políticas RLS. El cliente no recalcula el acceso; solo lo muestra.
export type BusinessAccessState = {
  hasDashboardAccess: boolean;
  needsPayment: boolean;
  /** Funciones Pro (página pública) disponibles, aunque la página no esté publicada. */
  hasPublicPageAccess: boolean;
  publicPagePublished: boolean;
  currentPlan: SubscriptionPlanId;
  pendingPlan: SubscriptionPlanId | null;
  isTrialing: boolean;
  trialDaysLeft: number;
  trialEndsAt: Date | null;
  hasPromotion: boolean;
  promotionPending: boolean;
  promotionStartsAt: Date | null;
  promotionEndsAt: Date | null;
  hasPaidPeriod: boolean;
  periodEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  isPastDue: boolean;
  awaitingFirstPayment: boolean;
  billingStartAt: string | null;
};

type RawAccessState = {
  has_dashboard_access: boolean;
  needs_payment: boolean;
  has_pro_features: boolean;
  public_page_published: boolean;
  current_plan: SubscriptionPlanId;
  pending_plan: SubscriptionPlanId | null;
  is_trialing: boolean;
  trial_days_left: number;
  trial_ends_at: string | null;
  has_promotion: boolean;
  promotion_pending: boolean;
  promotion_starts_at: string | null;
  promotion_ends_at: string | null;
  has_paid_period: boolean;
  period_ends_at: string | null;
  cancel_at_period_end: boolean;
  is_past_due: boolean;
  awaiting_first_payment: boolean;
  billing_start_at: string | null;
};

export const READ_ONLY_HINT = "Tu suscripción no está activa. Activá un plan para crear o modificar datos.";

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

export function parseBusinessAccessState(raw: RawAccessState): BusinessAccessState {
  return {
    hasDashboardAccess: raw.has_dashboard_access,
    needsPayment: raw.needs_payment,
    hasPublicPageAccess: raw.has_pro_features,
    publicPagePublished: raw.public_page_published,
    currentPlan: raw.current_plan,
    pendingPlan: raw.pending_plan,
    isTrialing: raw.is_trialing,
    trialDaysLeft: raw.trial_days_left,
    trialEndsAt: toDate(raw.trial_ends_at),
    hasPromotion: raw.has_promotion,
    promotionPending: raw.promotion_pending,
    promotionStartsAt: toDate(raw.promotion_starts_at),
    promotionEndsAt: toDate(raw.promotion_ends_at),
    hasPaidPeriod: raw.has_paid_period,
    periodEndsAt: toDate(raw.period_ends_at),
    cancelAtPeriodEnd: raw.cancel_at_period_end,
    isPastDue: raw.is_past_due,
    awaitingFirstPayment: raw.awaiting_first_payment,
    billingStartAt: raw.billing_start_at ? new Date(raw.billing_start_at).toISOString() : null,
  };
}

export async function fetchBusinessAccessState(client: Pick<InsForgeClient, "database">, businessId: string) {
  const { data, error } = await client.database.rpc("get_business_access_state", { p_business_id: businessId });
  if (error || !data) throw new Error(error?.message ?? "No se pudo leer el estado de la suscripción.");
  return parseBusinessAccessState(data as RawAccessState);
}
