import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminRequest, updateBusiness } from "./support/backend";
import { signIn } from "./support/dashboard";
import { E2E_MERCADOPAGO_WEBHOOK_SECRET } from "./support/constants";

test("permisos de prueba, Esencial, Pro y cambio pendiente", async ({ page, request }) => {
  const originalRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=*&limit=1")).json() as Record<string, unknown>[];
  const original = originalRows[0];
  if (!original) throw new Error("Falta el negocio demo.");

  try {
    const concurrentRequestIds = [randomUUID(), randomUUID()];
    const concurrentClaims = await Promise.all(concurrentRequestIds.map(async (requestId) => {
      const response = await adminRequest("rpc/claim_subscription_operation", {
        method: "POST",
        body: JSON.stringify({
          p_request_id: requestId,
          p_business_id: original.id,
          p_operation_type: "select_plan",
          p_requested_plan: "essential",
        }),
      });
      return (await response.json() as { claim_state: string }[])[0]?.claim_state;
    }));
    expect(concurrentClaims.sort()).toEqual(["busy", "claimed"]);
    await adminRequest(`records/subscription_operations?business_id=eq.${original.id}`, { method: "DELETE" });

    await updateBusiness(String(original.id), {
      subscription_status: "active",
      subscription_provider: "mercadopago",
      subscription_external_id: "e2e-subscription",
      subscription_plan: "essential",
      pending_subscription_plan: "pro",
      subscription_current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
      subscription_cancel_at_period_end: false,
    });

    await signIn(page);
    await page.goto("/negocio/configuracion");
    await expect(page.getByText("Plan Esencial")).toBeVisible();
    await expect(page.getByText(/Cambio a Pro/)).toBeVisible();
    await expect(page.getByLabel("Disponible con Pro")).toBeVisible();

    await page.goto("/b/citadely-demo-ux");
    await expect(page.getByRole("heading", { name: "Página no disponible" })).toBeVisible();

    const providerPaymentId = `e2e-${Date.now()}`;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await adminRequest("rpc/apply_mercadopago_subscription_payment", {
        method: "POST",
        body: JSON.stringify({
          p_business_id: original.id,
          p_subscription_external_id: "e2e-subscription",
          p_provider_payment_id: providerPaymentId,
          p_status: "approved",
          p_amount_cents: 1_800_000,
          p_currency: "ARS",
          p_paid_at: new Date().toISOString(),
          p_current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        }),
      });
    }

    await page.goto("/b/citadely-demo-ux");
    await expect(page.getByRole("heading", { name: "Consultorios Horizonte", exact: true })).toBeVisible();

    await updateBusiness(String(original.id), {
      subscription_status: "trialing",
      subscription_plan: "pro",
      trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
    });
    await page.goto("/b/citadely-demo-ux");
    await expect(page.getByRole("heading", { name: "Página no disponible" })).toBeVisible();

    const unauthenticated = await request.post("/api/mercadopago/subscription", { data: { businessId: original.id, plan: "pro", requestId: randomUUID() } });
    expect(unauthenticated.status()).toBe(401);
    const unsignedWebhook = await request.post("/api/mercadopago/webhook", { data: { type: "preapproval", data: { id: "fake" } } });
    expect(unsignedWebhook.status()).toBe(401);

    const simulatedBody = { id: "123456", type: "payment", date: "2021-11-01T02:02:02Z", data: { id: "123456" } };
    const timestamp = String(Math.floor(Date.now() / 1000));
    const incompleteSignature = createHmac("sha256", E2E_MERCADOPAGO_WEBHOOK_SECRET)
      .update(`id:123456;ts:${timestamp};`)
      .digest("hex");
    const incompleteWebhook = await request.post("/api/mercadopago/webhook?data.id=123456", {
      data: simulatedBody,
      headers: { "x-signature": `ts=${timestamp},v1=${incompleteSignature}` },
    });
    expect(incompleteWebhook.status()).toBe(401);

    const requestId = "e2e-signature-check";
    const signature = createHmac("sha256", E2E_MERCADOPAGO_WEBHOOK_SECRET)
      .update(`id:123456;request-id:${requestId};ts:${timestamp};`)
      .digest("hex");
    const signedWebhook = await request.post("/api/mercadopago/webhook?data.id=123456", {
      data: simulatedBody,
      headers: { "x-request-id": requestId, "x-signature": `ts=${timestamp},v1=${signature}` },
    });
    expect(signedWebhook.status()).toBe(200);
    expect(await signedWebhook.json()).toMatchObject({ received: true, simulated: true });
  } finally {
    await adminRequest(`records/subscription_payments?business_id=eq.${original.id}&provider_payment_id=like.e2e-*`, { method: "DELETE" });
    await updateBusiness(String(original.id), {
      subscription_status: original.subscription_status,
      subscription_provider: original.subscription_provider,
      subscription_external_id: original.subscription_external_id,
      subscription_checkout_url: original.subscription_checkout_url,
      subscription_plan: original.subscription_plan,
      pending_subscription_plan: original.pending_subscription_plan,
      subscription_current_period_end: original.subscription_current_period_end,
      subscription_cancel_at_period_end: original.subscription_cancel_at_period_end,
      subscription_last_payment_id: original.subscription_last_payment_id,
      subscription_last_payment_status: original.subscription_last_payment_status,
      subscription_last_payment_at: original.subscription_last_payment_at,
      trial_ends_at: original.trial_ends_at,
    });
  }
});
