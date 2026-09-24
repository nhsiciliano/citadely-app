import { expect, test } from "@playwright/test";
import { getBillingStartAt } from "@/lib/subscription-billing";

test("el primer cobro espera el fin del código y no el fin de la prueba", () => {
  const now = Date.parse("2026-09-24T12:00:00Z");
  const business = {
    trial_ends_at: "2026-10-01T12:00:00Z",
    promotion_ends_at: "2026-10-31T12:00:00Z",
    subscription_status: "trialing",
    subscription_cancel_at_period_end: false,
    subscription_current_period_end: null,
  };
  expect(getBillingStartAt(business, now)).toBe(new Date(business.promotion_ends_at).toISOString());
  expect(getBillingStartAt({ ...business, promotion_ends_at: null }, now)).toBe(new Date(business.trial_ends_at).toISOString());
  expect(getBillingStartAt({ ...business, trial_ends_at: "2026-09-01T12:00:00Z", promotion_ends_at: null }, now)).toBeNull();
});
