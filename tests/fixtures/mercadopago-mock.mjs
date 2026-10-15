import http from "node:http";

// MERCADOPAGO_MOCK_PORT permite levantar un mock aislado por sesión; por defecto, 3010 como en playwright.config.
const PORT = Number(process.env.MERCADOPAGO_MOCK_PORT ?? 3010);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const preapprovals = new Map();
// Facturas (authorized payments) registradas por los tests, por preapproval_id.
const invoices = new Map();
let latestPreapprovalId = null;
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

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", ORIGIN);

  if (request.method === "POST" && url.pathname === "/preapproval") {
    const body = await readBody(request);
    const id = `mock-preapproval-${PORT}-${Date.now().toString(36)}-${++sequence}`;
    const preapproval = { date_created: new Date().toISOString(), ...body, id, status: "pending", init_point: `${ORIGIN}/checkout/${id}` };
    preapprovals.set(id, preapproval);
    latestPreapprovalId = id;
    return send(response, 201, preapproval);
  }

  if (request.method === "GET" && url.pathname === "/preapproval/search") {
    const statuses = (url.searchParams.get("status") ?? "").split(",").filter(Boolean);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const matches = [...preapprovals.values()].filter((item) => !statuses.length || statuses.includes(item.status));
    return send(response, 200, { paging: { offset, limit, total: matches.length }, results: matches.slice(offset, offset + limit) });
  }

  if (request.method === "GET" && url.pathname === "/authorized_payments/search") {
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const matches = invoices.get(url.searchParams.get("preapproval_id") ?? "") ?? [];
    return send(response, 200, { paging: { offset, limit, total: matches.length }, results: matches.slice(offset, offset + limit) });
  }

  // Solo para tests: registra una factura de una preapproval existente.
  if (request.method === "POST" && url.pathname === "/__test/authorized_payments") {
    const body = await readBody(request);
    const preapproval = preapprovals.get(body.preapproval_id);
    if (!preapproval) return send(response, 404, { message: "Preapproval not found" });
    const invoice = {
      id: body.id,
      status: body.status ?? "processed",
      payment: { id: body.payment_id, status: body.payment_status },
      preapproval_id: preapproval.id,
      external_reference: preapproval.external_reference,
      transaction_amount: body.transaction_amount ?? preapproval.auto_recurring?.transaction_amount,
      currency_id: body.currency_id ?? preapproval.auto_recurring?.currency_id,
      date_created: body.date_created ?? new Date().toISOString(),
      date_approved: body.payment_status === "approved" ? (body.date_created ?? new Date().toISOString()) : undefined,
    };
    invoices.set(preapproval.id, [...(invoices.get(preapproval.id) ?? []), invoice]);
    return send(response, 201, invoice);
  }

  const preapprovalMatch = url.pathname.match(/^\/preapproval\/(.+)$/);
  if (preapprovalMatch) {
    const id = decodeURIComponent(preapprovalMatch[1]);
    const current = preapprovals.get(id);
    if (!current) return send(response, 404, { message: "Preapproval not found" });
    if (request.method === "PUT") {
      const body = await readBody(request);
      const updated = {
        ...current,
        ...body,
        auto_recurring: { ...current.auto_recurring, ...body.auto_recurring },
      };
      preapprovals.set(id, updated);
      latestPreapprovalId = id;
      return send(response, 200, updated);
    }
    if (request.method === "GET") return send(response, 200, current);
  }

  const authorizedMatch = url.pathname.match(/^\/authorized_payments\/(.+)$/);
  if (request.method === "GET" && authorizedMatch && latestPreapprovalId) {
    const preapproval = preapprovals.get(latestPreapprovalId);
    const suffix = decodeURIComponent(authorizedMatch[1]).replace(/\D/g, "") || "1";
    return send(response, 200, {
      id: Number(suffix),
      status: "approved",
      payment: { id: Number(`7${suffix}`), status: "approved" },
      preapproval_id: latestPreapprovalId,
      external_reference: preapproval.external_reference,
      transaction_amount: preapproval.auto_recurring.transaction_amount,
      currency_id: preapproval.auto_recurring.currency_id,
      date_approved: new Date().toISOString(),
    });
  }

  if (request.method === "GET" && url.pathname.startsWith("/checkout/")) {
    const id = decodeURIComponent(url.pathname.slice("/checkout/".length));
    const preapproval = preapprovals.get(id);
    if (preapproval) preapprovals.set(id, { ...preapproval, status: "authorized" });
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return response.end("<!doctype html><title>Mercado Pago mock</title><h1>Autorización simulada</h1>");
  }

  return send(response, 404, { message: "Mock route not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write("Mercado Pago mock ready\n");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
