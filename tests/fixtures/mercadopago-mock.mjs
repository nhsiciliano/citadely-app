import http from "node:http";

const preapprovals = new Map();
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
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3010");

  if (request.method === "POST" && url.pathname === "/preapproval") {
    const body = await readBody(request);
    const id = `mock-preapproval-${++sequence}`;
    const preapproval = { ...body, id, status: "pending", init_point: `http://127.0.0.1:3010/checkout/${id}` };
    preapprovals.set(id, preapproval);
    latestPreapprovalId = id;
    return send(response, 201, preapproval);
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
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return response.end("<!doctype html><title>Mercado Pago mock</title><h1>Autorización simulada</h1>");
  }

  return send(response, 404, { message: "Mock route not found" });
});

server.listen(3010, "127.0.0.1", () => {
  process.stdout.write("Mercado Pago mock ready\n");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
