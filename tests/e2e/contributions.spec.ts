import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { adminRequest, adminRows, RUN_ID } from "./support/backend";
import { E2E_MERCADOPAGO_WEBHOOK_SECRET, E2E_VERCEL_BYPASS_SECRET } from "./support/constants";
import { signIn } from "./support/dashboard";

// Aporte voluntario de punta a punta contra el mock de Checkout Pro (tests/fixtures/mercadopago-mock.mjs):
// panel → preferencia → pago aprobado en el mock → webhook firmado → aporte aprobado, email en el outbox y
// la lista del panel. Usa el negocio demo; el seed borra sus aportes y el finally borra lo que crea este spec.

const MOCK_ORIGIN = "http://127.0.0.1:3010";

type Preference = {
  id: string;
  external_reference: string;
  items: { id: string; title: string; quantity: number; unit_price: number; currency_id: string }[];
  back_urls: Record<"success" | "pending" | "failure", string>;
  notification_url: string;
  binary_mode: boolean;
};

/** Webhook de pago como lo manda Mercado Pago, firmado con el secreto del dev server del E2E. */
function sendPaymentWebhook(request: APIRequestContext, paymentId: string, notificationId: string) {
  const requestId = `e2e-contribution-${RUN_ID}-${notificationId}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", E2E_MERCADOPAGO_WEBHOOK_SECRET)
    .update(`id:${paymentId};request-id:${requestId};ts:${timestamp};`)
    .digest("hex");
  return request.post(`/api/mercadopago/webhook?data.id=${paymentId}`, {
    data: { id: notificationId, type: "payment", action: "payment.updated", data: { id: paymentId } },
    headers: { "x-request-id": requestId, "x-signature": `ts=${timestamp},v1=${signature}` },
  });
}

async function mockPayment(request: APIRequestContext, body: Record<string, unknown>) {
  const response = await request.post(`${MOCK_ORIGIN}/__test/payments`, { data: body });
  expect(response.status(), await response.text()).toBe(201);
  return String((await response.json() as { id: number }).id);
}

test("aporte voluntario: checkout, webhook aprobado, duplicados, pagos ajenos y lista del panel", async ({ page, request }) => {
  // Flujo largo (login, checkout, varios webhooks y dos cargas del panel) sobre un dev server en frío.
  test.slow();
  const [business] = await adminRows("businesses?slug=eq.citadely-demo-ux&select=id,owner_id&limit=1");
  if (!business) throw new Error("Falta el negocio demo (pnpm seed:demo).");
  const contributionIds: string[] = [];
  const paymentIds: string[] = [];

  try {
    await signIn(page);
    await page.goto("/negocio/configuracion");
    const section = page.locator("#aportes");
    await expect(section.getByRole("heading", { name: "Apoyá a Citadely" })).toBeVisible();
    await section.getByText("$5.000", { exact: true }).click();
    await expect(section.getByRole("radio", { name: /\$5\.000/ })).toBeChecked();
    await section.getByRole("button", { name: "Aportar con Mercado Pago" }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:3010\/checkout\/mock-preference-/);
    const preferenceId = decodeURIComponent(new URL(page.url()).pathname.slice("/checkout/".length));

    // La ruta guardó el aporte pendiente con el importe de la opción y el id de la preferencia.
    const [pending] = await adminRows(`contributions?provider_preference_id=eq.${encodeURIComponent(preferenceId)}&select=*`);
    expect(pending, "aporte pendiente").toBeTruthy();
    contributionIds.push(pending.id);
    expect(pending).toMatchObject({
      business_id: business.id, user_id: business.owner_id, amount_cents: 500_000, currency: "ARS",
      status: "pending", option_code: "small", external_reference: pending.id, provider_payment_id: null,
    });

    // Y creó la preferencia de Checkout Pro apuntando al aporte.
    const preference = await (await request.get(`${MOCK_ORIGIN}/checkout/preferences/${encodeURIComponent(preferenceId)}`)).json() as Preference;
    expect(preference.external_reference).toBe(pending.id);
    expect(preference.items).toEqual([{ id: pending.id, title: "Aporte a Citadely", quantity: 1, unit_price: 5000, currency_id: "ARS" }]);
    expect(preference.binary_mode).toBe(true);
    for (const [key, result] of [["success", "aprobado"], ["pending", "pendiente"], ["failure", "fallido"]] as const) {
      const backUrl = new URL(preference.back_urls[key]);
      expect(`${backUrl.pathname}${backUrl.search}`, key).toBe(`/negocio/configuracion?aporte=${result}`);
    }
    const notificationUrl = new URL(preference.notification_url);
    expect(notificationUrl.pathname).toBe("/api/mercadopago/webhook");
    expect(notificationUrl.searchParams.get("x-vercel-protection-bypass")).toBe(E2E_VERCEL_BYPASS_SECRET);

    // El pagador completa el checkout y Mercado Pago avisa por webhook.
    const paymentId = await mockPayment(request, { preference_id: preferenceId, status: "approved" });
    paymentIds.push(paymentId);
    const approved = await sendPaymentWebhook(request, paymentId, `${paymentId}-1`);
    expect(approved.status(), await approved.text()).toBe(200);
    expect(await approved.json()).toEqual({ received: true, result: "applied" });

    const [contribution] = await adminRows(`contributions?id=eq.${pending.id}&select=status,provider_payment_id,approved_at,payer_email`);
    expect(contribution).toMatchObject({ status: "approved", provider_payment_id: paymentId });
    expect(contribution.approved_at).toBeTruthy();
    expect(contribution.payer_email).toBeTruthy();
    const outboxPath = `email_outbox?idempotency_key=eq.contribution_received:${pending.id}&select=event_type,recipient_kind,user_id,payload`;
    const outbox = await adminRows(outboxPath);
    expect(outbox).toEqual([{
      event_type: "contribution_received", recipient_kind: "user", user_id: business.owner_id,
      payload: { amount_cents: 500_000, currency: "ARS", business_name: "Consultorios Horizonte", contribution_id: pending.id },
    }]);

    // El reintento de la misma notificación no se procesa de nuevo, y una notificación nueva del mismo pago
    // llega a la RPC pero no cambia nada: el email se encola una sola vez.
    const retried = await sendPaymentWebhook(request, paymentId, `${paymentId}-1`);
    expect(await retried.json()).toEqual({ received: true, duplicate: true });
    const repeated = await sendPaymentWebhook(request, paymentId, `${paymentId}-2`);
    expect(await repeated.json()).toEqual({ received: true, result: "duplicate" });

    // Otro pago de la misma preferencia (Checkout Pro lo permite) no toca el aporte ya aprobado.
    const secondPaymentId = await mockPayment(request, { preference_id: preferenceId, status: "approved" });
    paymentIds.push(secondPaymentId);
    const other = await sendPaymentWebhook(request, secondPaymentId, `${secondPaymentId}-1`);
    expect(await other.json()).toEqual({ received: true, result: "ignored_other_payment" });
    expect((await adminRows(`contributions?id=eq.${pending.id}&select=provider_payment_id`))[0].provider_payment_id).toBe(paymentId);
    expect(await adminRows(outboxPath)).toHaveLength(1);

    // Un pago cuya referencia no es un aporte se ignora con 200, para que Mercado Pago no reintente.
    const foreignReference = randomUUID();
    const foreignPreference = await request.post(`${MOCK_ORIGIN}/checkout/preferences`, {
      data: { items: [{ id: "x", title: "Otro cobro", quantity: 1, unit_price: 1000, currency_id: "ARS" }], external_reference: foreignReference },
    });
    expect(foreignPreference.status()).toBe(201);
    const foreignPaymentId = await mockPayment(request, { external_reference: foreignReference, status: "approved" });
    paymentIds.push(foreignPaymentId);
    const foreign = await sendPaymentWebhook(request, foreignPaymentId, `${foreignPaymentId}-1`);
    expect(foreign.status()).toBe(200);
    expect(await foreign.json()).toEqual({ received: true, ignored: "unknown_contribution" });

    // Al volver de Mercado Pago: banner de agradecimiento y el aporte en la lista.
    await page.goto("/negocio/configuracion?aporte=aprobado");
    await expect(section.getByText("¡Gracias por tu aporte!")).toBeVisible();
    const row = section.getByRole("listitem").filter({ hasText: "$5.000" });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Aprobado");
  } finally {
    for (const id of contributionIds) {
      await adminRequest(`records/email_outbox?idempotency_key=eq.contribution_received:${id}`, { method: "DELETE" }).catch(() => undefined);
      await adminRequest(`records/contributions?id=eq.${id}`, { method: "DELETE" }).catch(() => undefined);
    }
    if (paymentIds.length) {
      await adminRequest(`records/mercadopago_webhook_events?resource_id=in.(${paymentIds.join(",")})`, { method: "DELETE" }).catch(() => undefined);
    }
  }
});
