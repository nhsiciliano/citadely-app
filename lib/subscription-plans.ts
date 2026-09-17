export const SUBSCRIPTION_PLANS = {
  essential: {
    id: "essential",
    name: "Esencial",
    priceCents: 1_400_000,
    description: "Dashboard completo para administrar agenda, servicios y clientes.",
    features: ["Agenda y turnos", "Servicios y disponibilidad", "Clientes", "Señas y estados", "Métricas operativas"],
    publicPage: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceCents: 1_800_000,
    description: "Dashboard completo más página pública personalizable y reservas online.",
    features: ["Todo lo incluido en Esencial", "Página pública editable", "Identidad visual personalizada", "Reservas online de clientes"],
    publicPage: true,
  },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;

export function isSubscriptionPlanId(value: unknown): value is SubscriptionPlanId {
  return typeof value === "string" && value in SUBSCRIPTION_PLANS;
}

export function getSubscriptionPlan(planId: SubscriptionPlanId) {
  return SUBSCRIPTION_PLANS[planId];
}
