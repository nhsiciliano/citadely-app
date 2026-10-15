import "server-only";

import { createClient } from "@insforge/sdk";
import { buildSubscriptionPlans, SUBSCRIPTION_PLAN_COLUMNS, type SubscriptionPlans } from "@/lib/subscription-plans";

const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

/**
 * Active plan prices from subscription_plans (public read, anon key).
 * During `next build` an unreachable backend yields null so the page can still be generated
 * (it is revalidated afterwards); at runtime errors are thrown so ISR keeps serving the last good page.
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlans | null> {
  try {
    if (!baseUrl) throw new Error("Missing NEXT_PUBLIC_INSFORGE_BASE_URL.");
    const client = createClient({ baseUrl, ...(anonKey ? { anonKey } : {}), isServerMode: true });
    const { data, error } = await client.database.from("subscription_plans").select(SUBSCRIPTION_PLAN_COLUMNS);
    if (error) throw new Error(error.message);
    return buildSubscriptionPlans(data);
  } catch (error) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      console.warn("subscription_plans unavailable during build; prices will be filled on revalidation");
      return null;
    }
    throw error;
  }
}

export async function requireSubscriptionPlans(): Promise<SubscriptionPlans> {
  const plans = await getSubscriptionPlans();
  if (!plans) throw new Error("No se pudieron leer los precios de los planes.");
  return plans;
}
