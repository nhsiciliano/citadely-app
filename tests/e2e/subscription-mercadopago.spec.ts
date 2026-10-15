import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminRequest, updateBusiness } from "./support/backend";
import { signIn } from "./support/dashboard";

test("suscripción Mercado Pago: prueba, aprobación, duplicados, mora y reembolso", async ({ page, request }) => {
  const originalRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=*&limit=1")).json() as Record<string, unknown>[];
  const original = originalRows[0];
  if (!original) throw new Error("Falta el negocio demo.");

  const trialEnd = new Date(Date.now() + 6 * 86_400_000).toISOString();
  const authorizedPaymentId = "9001";
  const providerPaymentId = "79001";

  try {
    await updateBusiness(String(original.id), {
      trial_ends_at: trialEnd,
      subscription_status: "trialing",
      subscription_provider: null,
      subscription_external_id: null,
      subscription_checkout_url: null,
      subscription_current_period_end: null,
      subscription_plan: "pro",
      pending_subscription_plan: null,
      subscription_cancel_at_period_end: false,
      subscription_last_payment_id: null,
      subscription_last_payment_status: null,
      subscription_last_payment_at: null,
    });

    await signIn(page);
    await page.goto("/negocio/configuracion");
    await page.getByRole("button", { name: "Elegir Esencial" }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:3010\/checkout\/mock-preapproval-/);

    const pendingRows = await (await adminRequest(`records/businesses?id=eq.${original.id}&select=subscription_external_id,pending_subscription_plan,subscription_status&limit=1`)).json() as Record<string, unknown>[];
    expect(pendingRows[0]).toMatchObject({ pending_subscription_plan: "essential", subscription_status: "trialing" });
    expect(String(pendingRows[0]?.subscription_external_id)).toMatch(/^mock-preapproval-/);

    const providerPreapprovalResponse = await request.get(`http://127.0.0.1:3010/preapproval/${pendingRows[0]?.subscription_external_id}`);
    const providerPreapproval = await providerPreapprovalResponse.json() as { notification_url: string; status: string };
    expect(providerPreapproval.status).toBe("authorized");
    expect(new URL(providerPreapproval.notification_url).searchParams.get("x-vercel-protection-bypass")).toBe("e2e-vercel-bypass");

    const preapprovalRequestId = "e2e-preapproval-request";
    const preapprovalTimestamp = String(Math.floor(Date.now() / 1000));
    const preapprovalDataId = String(pendingRows[0]?.subscription_external_id);
    const preapprovalSignature = createHmac("sha256", "e2e-webhook-secret")
      .update(`id:${preapprovalDataId};request-id:${preapprovalRequestId};ts:${preapprovalTimestamp};`)
      .digest("hex");
    const preapprovalWebhook = await request.post(`/api/mercadopago/webhook?data.id=${preapprovalDataId}`, {
      data: { id: "e2e-preapproval-notification", type: "preapproval", action: "updated", data: { id: preapprovalDataId } },
      headers: { "x-request-id": preapprovalRequestId, "x-signature": `ts=${preapprovalTimestamp},v1=${preapprovalSignature}` },
    });
    expect(preapprovalWebhook.status()).toBe(200);
    const authorizedRows = await (await adminRequest(`records/businesses?id=eq.${original.id}&select=subscription_status,pending_subscription_plan,subscription_checkout_url&limit=1`)).json() as Record<string, unknown>[];
    expect(authorizedRows[0]).toMatchObject({ subscription_status: "trialing", pending_subscription_plan: "essential", subscription_checkout_url: null });
    await page.goto("/negocio/configuracion");
    await expect(page.getByText("Medio de pago autorizado", { exact: true })).toBeVisible();

    const webhookBody = {
      id: "e2e-authorized-notification",
      type: "subscription_authorized_payment",
      action: "updated",
      data: { id: authorizedPaymentId },
    };
    const webhookRequestId = "e2e-authorized-request";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", "e2e-webhook-secret")
      .update(`id:${authorizedPaymentId};request-id:${webhookRequestId};ts:${timestamp};`)
      .digest("hex");
    const webhookOptions = {
      data: webhookBody,
      headers: { "x-request-id": webhookRequestId, "x-signature": `ts=${timestamp},v1=${signature}` },
    };

    const approvedWebhook = await request.post(`/api/mercadopago/webhook?data.id=${authorizedPaymentId}`, webhookOptions);
    expect(approvedWebhook.status()).toBe(200);
    const duplicateWebhook = await request.post(`/api/mercadopago/webhook?data.id=${authorizedPaymentId}`, webhookOptions);
    expect(await duplicateWebhook.json()).toMatchObject({ received: true, duplicate: true });

    const activeRows = await (await adminRequest(`records/businesses?id=eq.${original.id}&select=subscription_status,subscription_plan,pending_subscription_plan,subscription_current_period_end&limit=1`)).json() as Record<string, unknown>[];
    expect(activeRows[0]).toMatchObject({ subscription_status: "active", subscription_plan: "essential", pending_subscription_plan: null });
    expect(new Date(String(activeRows[0]?.subscription_current_period_end)).getTime()).toBeGreaterThan(Date.now());

    await page.goto("/negocio/configuracion");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancelar renovación" }).click();
    await expect(page.getByText(/Renovación cancelada\. Conservás el acceso/)).toBeVisible();
    const cancelledRows = await (await adminRequest(`records/businesses?id=eq.${original.id}&select=subscription_cancel_at_period_end&limit=1`)).json() as Record<string, unknown>[];
    expect(cancelledRows[0]?.subscription_cancel_at_period_end).toBe(true);
    const accessAfterCancellation = await (await adminRequest("rpc/business_has_dashboard_access", { method: "POST", body: JSON.stringify({ target_business_id: original.id }) })).json();
    expect(accessAfterCancellation).toBe(true);

    await adminRequest("rpc/apply_mercadopago_subscription_payment", {
      method: "POST",
      body: JSON.stringify({
        p_business_id: original.id,
        p_subscription_external_id: pendingRows[0]?.subscription_external_id,
        p_provider_payment_id: "e2e-failed-renewal",
        p_status: "rejected",
        p_amount_cents: 1_400_000,
        p_currency: "ARS",
      }),
    });
    const paidAccess = await (await adminRequest("rpc/business_has_dashboard_access", { method: "POST", body: JSON.stringify({ target_business_id: original.id }) })).json();
    expect(paidAccess).toBe(true);

    await adminRequest("rpc/apply_mercadopago_subscription_payment", {
      method: "POST",
      body: JSON.stringify({
        p_business_id: original.id,
        p_subscription_external_id: pendingRows[0]?.subscription_external_id,
        p_provider_payment_id: providerPaymentId,
        p_status: "refunded",
        p_amount_cents: 1_400_000,
        p_currency: "ARS",
      }),
    });
    const revokedAccess = await (await adminRequest("rpc/business_has_dashboard_access", { method: "POST", body: JSON.stringify({ target_business_id: original.id }) })).json();
    expect(revokedAccess).toBe(false);

    const staleApproval = await adminRequest("rpc/apply_mercadopago_subscription_payment", {
      method: "POST",
      body: JSON.stringify({
        p_business_id: original.id,
        p_subscription_external_id: pendingRows[0]?.subscription_external_id,
        p_provider_payment_id: providerPaymentId,
        p_status: "approved",
        p_amount_cents: 1_400_000,
        p_currency: "ARS",
        p_paid_at: new Date().toISOString(),
      }),
    });
    expect(await staleApproval.json()).toBe("revoked");
    const stillRevoked = await (await adminRequest("rpc/business_has_dashboard_access", { method: "POST", body: JSON.stringify({ target_business_id: original.id }) })).json();
    expect(stillRevoked).toBe(false);
  } finally {
    await adminRequest(`records/subscription_webhook_events?resource_id=eq.${authorizedPaymentId}`, { method: "DELETE" });
    await adminRequest("records/subscription_webhook_events?resource_id=like.mock-preapproval-*", { method: "DELETE" });
    await adminRequest(`records/subscription_operations?business_id=eq.${original.id}`, { method: "DELETE" });
    await adminRequest(`records/subscription_payments?business_id=eq.${original.id}`, { method: "DELETE" });
    await updateBusiness(String(original.id), {
      trial_ends_at: original.trial_ends_at,
      subscription_status: original.subscription_status,
      subscription_provider: original.subscription_provider,
      subscription_external_id: original.subscription_external_id,
      subscription_checkout_url: original.subscription_checkout_url,
      subscription_current_period_end: original.subscription_current_period_end,
      subscription_plan: original.subscription_plan,
      pending_subscription_plan: original.pending_subscription_plan,
      subscription_cancel_at_period_end: original.subscription_cancel_at_period_end,
      subscription_last_payment_id: original.subscription_last_payment_id,
      subscription_last_payment_status: original.subscription_last_payment_status,
      subscription_last_payment_at: original.subscription_last_payment_at,
    });
  }
});

test("suscripción Mercado Pago: cancelación pendiente y reactivación", async ({ page }) => {
  const originalRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=*&limit=1")).json() as Record<string, unknown>[];
  const original = originalRows[0];
  if (!original) throw new Error("Falta el negocio demo.");

  try {
    await updateBusiness(String(original.id), {
      trial_ends_at: new Date(Date.now() + 6 * 86_400_000).toISOString(),
      subscription_status: "trialing",
      subscription_provider: null,
      subscription_external_id: null,
      subscription_checkout_url: null,
      subscription_current_period_end: null,
      subscription_plan: "pro",
      pending_subscription_plan: null,
      subscription_cancel_at_period_end: false,
    });

    await signIn(page);
    await page.goto("/negocio/configuracion");
    await page.getByRole("button", { name: "Elegir Esencial" }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:3010\/checkout\/mock-preapproval-/);
    const firstRows = await (await adminRequest(`records/businesses?id=eq.${original.id}&select=subscription_external_id&limit=1`)).json() as Record<string, unknown>[];
    const firstExternalId = String(firstRows[0]?.subscription_external_id);

    await page.goto("/negocio/configuracion");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancelar renovación" }).click();
    await expect(page.getByText("Suscripción pendiente cancelada. No se realizará ningún cobro.")).toBeVisible();

    await page.getByRole("button", { name: "Elegir Esencial" }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:3010\/checkout\/mock-preapproval-/);
    const reactivatedRows = await (await adminRequest(`records/businesses?id=eq.${original.id}&select=subscription_external_id,pending_subscription_plan&limit=1`)).json() as Record<string, unknown>[];
    expect(reactivatedRows[0]?.pending_subscription_plan).toBe("essential");
    expect(reactivatedRows[0]?.subscription_external_id).not.toBe(firstExternalId);
  } finally {
    await adminRequest(`records/subscription_operations?business_id=eq.${original.id}`, { method: "DELETE" });
    await updateBusiness(String(original.id), {
      trial_ends_at: original.trial_ends_at,
      subscription_status: original.subscription_status,
      subscription_provider: original.subscription_provider,
      subscription_external_id: original.subscription_external_id,
      subscription_checkout_url: original.subscription_checkout_url,
      subscription_current_period_end: original.subscription_current_period_end,
      subscription_plan: original.subscription_plan,
      pending_subscription_plan: original.pending_subscription_plan,
      subscription_cancel_at_period_end: original.subscription_cancel_at_period_end,
      subscription_last_payment_id: original.subscription_last_payment_id,
      subscription_last_payment_status: original.subscription_last_payment_status,
      subscription_last_payment_at: original.subscription_last_payment_at,
    });
  }
});
