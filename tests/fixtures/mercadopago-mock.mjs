import http from "node:http";

// Mock de Checkout Pro para los E2E de aportes. La app crea preferencias y lee pagos; los tests
// registran el pago con /__test/payments y después envían el webhook firmado.
// MERCADOPAGO_MOCK_PORT permite levantar un mock aislado por sesión; por defecto, 3010 como en playwright.config.
const PORT = Number(process.env.MERCADOPAGO_MOCK_PORT ?? 3010);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const preferences = new Map();
const payments = new Map();
let sequence = 0;

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", ORIGIN);

  if (request.method === "POST" && url.pathname === "/checkout/preferences") {
    const body = await readBody(request);
    const item = Array.isArray(body.items) ? body.items[0] : undefined;
    if (!item || !(Number(item.unit_price) > 0) || !body.external_reference) {
      return send(response, 400, { message: "invalid preference", error: "bad_request", status: 400 });
    }
    const id = `mock-preference-${PORT}-${Date.now().toString(36)}-${++sequence}`;
    const checkoutUrl = `${ORIGIN}/checkout/${id}`;
    const preference = {
      date_created: new Date().toISOString(),
      ...body,
      id,
      init_point: checkoutUrl,
      sandbox_init_point: checkoutUrl,
    };
    preferences.set(id, preference);
    return send(response, 201, preference);
  }

  const preferenceMatch = url.pathname.match(/^\/checkout\/preferences\/(.+)$/);
  if (request.method === "GET" && preferenceMatch) {
    const preference = preferences.get(decodeURIComponent(preferenceMatch[1]));
    return preference ? send(response, 200, preference) : send(response, 404, { message: "Preference not found" });
  }

  // Solo para tests: registra el pago de una preferencia existente, como si el pagador hubiera
  // completado el checkout. Acepta preference_id o external_reference; id y status son opcionales.
  if (request.method === "POST" && url.pathname === "/__test/payments") {
    const body = await readBody(request);
    const preference = body.preference_id
      ? preferences.get(body.preference_id)
      : [...preferences.values()].find((item) => item.external_reference === body.external_reference);
    if (!preference) return send(response, 404, { message: "Preference not found" });
    const item = preference.items[0];
    const status = body.status ?? "approved";
    const now = new Date().toISOString();
    const payment = {
      id: Number(body.id ?? `9${Date.now().toString().slice(-8)}${++sequence}`),
      status,
      status_detail: body.status_detail ?? (status === "approved" ? "accredited" : "cc_rejected_other_reason"),
      external_reference: preference.external_reference,
      preference_id: preference.id,
      transaction_amount: body.transaction_amount ?? item.unit_price,
      currency_id: body.currency_id ?? item.currency_id ?? "ARS",
      payer: { email: body.payer_email ?? preference.payer?.email ?? "payer@testuser.com" },
      metadata: preference.metadata ?? {},
      date_created: now,
      date_approved: status === "approved" ? now : null,
      date_last_updated: now,
    };
    payments.set(String(payment.id), payment);
    return send(response, 201, payment);
  }

  const paymentMatch = url.pathname.match(/^\/v1\/payments\/(.+)$/);
  if (request.method === "GET" && paymentMatch) {
    const payment = payments.get(decodeURIComponent(paymentMatch[1]));
    return payment ? send(response, 200, payment) : send(response, 404, { message: "Payment not found", status: 404 });
  }

  // Página del checkout (también responde /checkout/health, la URL de readiness de Playwright).
  if (request.method === "GET" && url.pathname.startsWith("/checkout/")) {
    const id = decodeURIComponent(url.pathname.slice("/checkout/".length));
    const preference = preferences.get(id);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return response.end(
      `<!doctype html><title>Mercado Pago mock</title><h1>Checkout simulado</h1>${
        preference ? `<p data-preference-id="${escapeHtml(id)}">${escapeHtml(preference.items[0].title)} · $${escapeHtml(preference.items[0].unit_price)}</p>` : ""
      }`,
    );
  }

  return send(response, 404, { message: "Mock route not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write("Mercado Pago mock ready\n");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
