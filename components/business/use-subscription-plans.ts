"use client";

import { useEffect, useState } from "react";
import { insforge } from "@/lib/insforge";
import { buildSubscriptionPlans, SUBSCRIPTION_PLAN_COLUMNS, type SubscriptionPlans } from "@/lib/subscription-plans";

/** Active plan prices from subscription_plans; null while loading or if the lookup failed. */
export function useSubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlans | null>(null);

  useEffect(() => {
    let cancelled = false;
    void insforge.database.from("subscription_plans").select(SUBSCRIPTION_PLAN_COLUMNS).then(({ data, error }) => {
      if (cancelled || error) return;
      try {
        setPlans(buildSubscriptionPlans(data));
      } catch {
        setPlans(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return plans;
}
