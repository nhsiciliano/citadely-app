// Plan copy lives here; prices do not. The single source of truth for amounts is the
// public.subscription_plans table (read by apply_mercadopago_subscription_payment too).
export const SUBSCRIPTION_PLAN_DETAILS = {
  essential: {
    id: "essential",
    name: "Esencial",
    description: "Dashboard completo para administrar agenda, servicios y clientes.",
    features: ["Agenda y turnos", "Servicios y disponibilidad", "Clientes", "Señas y estados", "Métricas operativas"],
    publicPage: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Dashboard completo más página pública personalizable y reservas online.",
    features: ["Todo lo incluido en Esencial", "Página pública editable", "Identidad visual personalizada", "Reservas online de clientes"],
    publicPage: true,
  },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLAN_DETAILS;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLAN_DETAILS)[SubscriptionPlanId] & {
  priceCents: number;
  currency: string;
};

export type SubscriptionPlans = Record<SubscriptionPlanId, SubscriptionPlan>;

export type SubscriptionPlanRow = { code: string; amount_cents: number; currency: string };

export function isSubscriptionPlanId(value: unknown): value is SubscriptionPlanId {
  return typeof value === "string" && value in SUBSCRIPTION_PLAN_DETAILS;
}

export const SUBSCRIPTION_PLAN_COLUMNS = "code,amount_cents,currency";

/** Merges the plan copy with the active prices from subscription_plans. Throws if a plan has no price. */
export function buildSubscriptionPlans(rows: SubscriptionPlanRow[] | null | undefined): SubscriptionPlans {
  const plans = {} as SubscriptionPlans;
  for (const id of Object.keys(SUBSCRIPTION_PLAN_DETAILS) as SubscriptionPlanId[]) {
    const row = rows?.find((candidate) => candidate.code === id);
    if (!row) throw new Error(`Falta el precio del plan ${id} en subscription_plans.`);
    plans[id] = { ...SUBSCRIPTION_PLAN_DETAILS[id], priceCents: Number(row.amount_cents), currency: row.currency };
  }
  return plans;
}

export function formatPlanPrice(priceCents: number) {
  return `$${(priceCents / 100).toLocaleString("es-AR")}`;
}
