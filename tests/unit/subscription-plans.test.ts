import { describe, expect, it } from "vitest";
import { buildSubscriptionPlans, formatPlanPrice, isSubscriptionPlanId } from "@/lib/subscription-plans";

describe("lib/subscription-plans", () => {
  const rows = [
    { code: "essential", amount_cents: 1400000, currency: "ARS" },
    { code: "pro", amount_cents: 1800000, currency: "ARS" },
  ];

  it("combina los textos del plan con los precios de la tabla", () => {
    const plans = buildSubscriptionPlans(rows);
    expect(plans.essential).toMatchObject({ id: "essential", name: "Esencial", priceCents: 1400000, currency: "ARS", publicPage: false });
    expect(plans.pro).toMatchObject({ id: "pro", priceCents: 1800000, publicPage: true });
  });

  it("falla si falta el precio de un plan", () => {
    expect(() => buildSubscriptionPlans([rows[0]])).toThrow(/pro/);
    expect(() => buildSubscriptionPlans(null)).toThrow();
  });

  it("formatea precios en pesos argentinos", () => {
    expect(formatPlanPrice(1400000)).toBe("$14.000");
    expect(isSubscriptionPlanId("pro")).toBe(true);
    expect(isSubscriptionPlanId("enterprise")).toBe(false);
  });
});
