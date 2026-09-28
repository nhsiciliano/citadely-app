import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

test.setTimeout(90_000);

function readLocalCredential(name: string) {
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((candidate) => candidate.startsWith(`${name}=`));
  if (!line) throw new Error(`Falta ${name} en .env.local. Ejecutá pnpm seed:demo.`);
  return line.slice(name.length + 1);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(readLocalCredential("CITADELY_DEMO_EMAIL"));
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(readLocalCredential("CITADELY_DEMO_PASSWORD"));
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/negocio/);
  await expect(page.getByText("Consultorios Horizonte").first()).toBeVisible();
}

function branchProject() {
  const project = JSON.parse(readFileSync(".insforge/project.json", "utf8")) as { oss_host: string; api_key: string };
  return project;
}

async function adminRequest(path: string, init?: RequestInit) {
  const project = branchProject();
  const response = await fetch(`${project.oss_host}/api/database/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${project.api_key}`,
      "Content-Type": "application/json",
      "x-api-key": project.api_key,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`InsForge ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response;
}

async function updateBusiness(id: string, values: Record<string, unknown>) {
  await adminRequest(`records/businesses?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(values) });
}

test.beforeAll(() => {
  execFileSync(process.execPath, ["scripts/seed-citadely-demo.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, SEED_ALLOW_WRITE: "true" },
    stdio: "pipe",
    timeout: 120_000,
  });
});

test("SEO público, indexación y errores reales", async ({ page, request }) => {
  const permissionCheck = execFileSync(process.execPath, [
    "--env-file=.env.local",
    "--input-type=module",
    "-e",
    `import { createClient } from "@insforge/sdk";
     const client = createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
     const safe = await client.database.from("businesses").select("id,name,slug").eq("is_public", true).limit(1);
     const protectedRead = await client.database.from("businesses").select("id,subscription_external_id").limit(1);
     if (safe.error || !safe.data?.length || !protectedRead.error) process.exit(1);
     process.stdout.write("ok");`,
  ], { cwd: process.cwd(), encoding: "utf8" });
  expect(permissionCheck).toBe("ok");

  await page.goto("/");
  await expect(page).toHaveTitle("Citadely | Agenda y turnos online para negocios");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://citadely.com.ar");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /citadely\.com\.ar\/opengraph-image/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);

  await page.goto("/b/citadely-demo-ux");
  await expect(page).toHaveTitle("Consultorios Horizonte | Turnos online | Citadely");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://citadely-demo-ux.citadely.com.ar/");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);

  const missingResponse = await page.goto("/b/seo-url-inexistente");
  expect(missingResponse?.status()).toBe(404);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  await page.goto("/login");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Sitemap: https://citadely.com.ar/sitemap.xml");
  const sitemap = await request.get("/sitemap.xml");
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("https://citadely.com.ar");
  expect(sitemapBody).toContain("https://citadely-demo-ux.citadely.com.ar/");
});

test("landing, navegación operativa, CRUD y reserva pública", async ({ page }) => {
  const runId = Date.now().toString(36);
  let serviceName = `Seguimiento E2E ${runId}`;
  const clientName = `Cliente E2E ${runId}`;
  const publicClientName = `Reserva Pública ${runId}`;
  const availabilityDate = new Date();
  availabilityDate.setDate(availabilityDate.getDate() + 7);
  availabilityDate.setHours(10, 0, 0, 0);
  const monthValue = `${availabilityDate.getFullYear()}-${String(availabilityDate.getMonth() + 1).padStart(2, "0")}`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /tomá el control de cada jornada/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Esencial" })).toBeVisible();
  await expect(page.getByText("$14.000", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  await expect(page.getByText("$18.000", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /crear mi cuenta/i }).first()).toBeVisible();
  await signIn(page);

  for (const [label, path, heading] of [
    ["Agenda", "/negocio/agenda", "Agenda"],
    ["Servicios", "/negocio/servicios", "Servicios"],
    ["Clientes", "/negocio/clientes", "Clientes"],
    ["Página pública", "/negocio/pagina-publica", "Página pública"],
    ["Configuración", "/negocio/configuracion", "Configuración"],
  ] as const) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.getByLabel("Alias").fill(`demo.${runId}`);
  await page.getByLabel("CBU o CVU").fill("0000003100012345678901");
  await page.getByLabel("Instrucciones de pago").fill("Enviar comprobante por WhatsApp.");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText("Configuración guardada.")).toBeVisible();

  await page.goto("/negocio/pagina-publica");
  await expect(page.locator("h2").filter({ hasText: /^Galería$/ })).toBeVisible();
  await page.getByLabel("WhatsApp de contacto").fill("5491123456789");
  await page.getByLabel("Dirección pública").fill("Av. Corrientes 1234, Ciudad Autónoma de Buenos Aires");
  if (await page.getByRole("button", { name: /Eliminar foto/ }).count() === 0) {
    await page.locator('input[name="gallery_files"]').setInputFiles({
      name: `galeria-${runId}.png`,
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
  }
  if (await page.getByRole("group", { name: /Pregunta frecuente/ }).count() === 0) {
    await page.getByRole("button", { name: "Agregar pregunta" }).click();
  }
  const faqEditor = page.getByRole("group", { name: /Pregunta frecuente/ }).first();
  await faqEditor.getByLabel("Pregunta", { exact: true }).fill("¿Cómo solicito mi turno?");
  await page.locator('textarea[placeholder="Elegí un servicio, fecha y horario disponible."]').first().fill("Elegí un servicio y uno de los horarios disponibles.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Página pública actualizada.")).toBeVisible();

  await page.goto("/negocio/servicios?nuevo=1");
  const serviceDialog = page.getByRole("dialog", { name: "Nuevo servicio" });
  await expect(serviceDialog).toBeVisible();
  await serviceDialog.getByLabel("Nombre").fill(serviceName);
  await serviceDialog.getByLabel("Descripción").fill("Servicio sintético creado por la cobertura E2E.");
  await serviceDialog.getByLabel("Duración en minutos").fill("30");
  await serviceDialog.getByLabel("Precio").fill("22000");
  await serviceDialog.getByLabel("Cobro al reservar").selectOption("free");
  await serviceDialog.getByLabel("Mes").selectOption(monthValue);
  await serviceDialog.getByRole("button", { name: new RegExp(`^${availabilityDate.getDate()}`) }).first().click();
  await serviceDialog.locator('input[type="time"]').fill("10:00");
  await serviceDialog.getByRole("button", { name: "Agregar" }).click();
  await expect(serviceDialog.getByText("10:00")).toBeVisible();
  await serviceDialog.locator('input[type="time"]').fill("11:00");
  await serviceDialog.getByRole("button", { name: "Agregar" }).click();
  await expect(serviceDialog.getByText("11:00")).toBeVisible();
  await serviceDialog.getByRole("button", { name: "Guardar servicio" }).click();
  await expect(serviceDialog).toBeHidden();
  await expect(page.getByText(serviceName)).toBeVisible();

  await page.getByRole("button", { name: `Editar ${serviceName}` }).click();
  const editServiceDialog = page.getByRole("dialog", { name: "Editar servicio" });
  await expect(editServiceDialog.getByLabel("Nombre")).toHaveValue(serviceName);
  await expect(editServiceDialog.getByLabel("Duración en minutos")).toHaveValue("30");
  const editedServiceName = `Seguimiento editado E2E ${runId}`;
  await editServiceDialog.getByLabel("Nombre").fill(editedServiceName);
  await editServiceDialog.getByLabel("Duración en minutos").fill("45");
  await editServiceDialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(editServiceDialog).toBeHidden();
  serviceName = editedServiceName;
  await expect(page.getByText(serviceName)).toBeVisible();

  await page.goto("/negocio/clientes?nuevo=1");
  const clientDialog = page.getByRole("dialog", { name: "Nuevo cliente" });
  await expect(clientDialog).toBeVisible();
  await clientDialog.getByLabel("Nombre").fill(clientName);
  await clientDialog.getByLabel("Email").fill(`cliente-${runId}@example.com`);
  await clientDialog.getByLabel("Teléfono").fill("1122334455");
  await clientDialog.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(clientDialog).toBeHidden();
  await expect(page.getByText(clientName)).toBeVisible();

  await page.goto("/negocio/agenda");
  await expect(page.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Día" }).click();
  await expect(page.getByRole("button", { name: "Día" })).toHaveAttribute("aria-pressed", "true");
  for (let day = 0; day < 7; day += 1) await page.getByRole("button", { name: "Período siguiente" }).click();
  await page.getByLabel("Filtrar por servicio").selectOption({ label: serviceName });
  await page.getByLabel("Filtrar por estado").selectOption("available");
  await expect(page.getByText("Turno libre").first()).toBeVisible();
  await page.getByLabel("Filtrar por estado").selectOption("all");
  await page.getByRole("button", { name: "Nuevo turno" }).click();
  const appointmentDialog = page.getByRole("dialog", { name: "Nuevo turno" });
  await appointmentDialog.getByLabel("Cliente").selectOption({ label: clientName });
  await appointmentDialog.getByRole("button", { name: new RegExp(serviceName) }).click();
  await appointmentDialog.getByRole("button", { name: "11:00" }).click();
  await appointmentDialog.getByRole("button", { name: "Guardar turno" }).click();
  await expect(appointmentDialog).toBeHidden();

  await page.goto("/negocio#servicios");
  await expect(page).toHaveURL(/\/negocio\/servicios/);

  await page.goto("/b/citadely-demo-ux");
  await expect(page.getByRole("heading", { name: "Consultorios Horizonte", exact: true })).toBeVisible();
  const publicHeader = page.locator("header").first();
  await expect(publicHeader).not.toContainText(/fechas disponibles|lun|mar|mié|jue|vie/i);
  await expect(publicHeader.getByRole("link", { name: "Reservar turno" })).toBeVisible();
  await expect(publicHeader.getByRole("link", { name: "Contactar a Consultorios Horizonte por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5491123456789/);
  const informationHeading = page.getByRole("heading", { name: "Información del servicio", exact: true });
  await expect(informationHeading).toBeVisible();
  await expect(page.getByText("+5491123456789", { exact: true })).toBeVisible();
  await expect(page.getByText("Av. Corrientes 1234, Ciudad Autónoma de Buenos Aires", { exact: true })).toBeVisible();
  await expect(page.getByTitle("Mapa de Consultorios Horizonte")).toHaveAttribute("src", /maps\.google\.com\/maps\?q=Av\.%20Corrientes%201234/);
  await expect(page.getByRole("heading", { name: "Galería", exact: true })).toBeVisible();
  const publicHeadings = await page.locator("h2").allTextContents();
  expect(publicHeadings.indexOf("Información del servicio")).toBeLessThan(publicHeadings.indexOf("Galería"));
  await expect(page.getByRole("heading", { name: "Preguntas frecuentes", exact: true })).toBeVisible();
  await page.getByText("¿Cómo solicito mi turno?").click();
  await expect(page.getByText("Elegí un servicio y uno de los horarios disponibles.")).toBeVisible();
  const publicService = page.getByRole("button", { name: new RegExp(serviceName) });
  await publicService.click();
  await page.getByRole("button", { name: /10:00/ }).last().click();
  await page.getByLabel("Nombre y apellido").fill(publicClientName);
  await page.getByLabel("Email").fill(`publico-${runId}@example.com`);
  await page.getByLabel("Teléfono").fill("1199887766");
  await page.getByLabel("Nota para el negocio").fill("Reserva generada por Playwright");
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByText(/reserva confirmada/i)).toBeVisible();

  await page.goto("/negocio/clientes");
  await page.getByRole("searchbox", { name: "Buscar clientes" }).fill(publicClientName);
  await expect(page.getByText(publicClientName)).toBeVisible();
});

test("oculta contacto y mapa cuando faltan datos públicos", async ({ page }) => {
  const originalRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=id,whatsapp_phone,public_address&limit=1")).json() as Record<string, unknown>[];
  const original = originalRows[0];
  if (!original) throw new Error("Falta el negocio demo.");

  try {
    await updateBusiness(String(original.id), { whatsapp_phone: null, public_address: null });
    await page.goto("/b/citadely-demo-ux");
    await expect(page.getByRole("heading", { name: "Información del servicio", exact: true })).toBeVisible();
    await expect(page.locator("header").first().getByRole("link", { name: /WhatsApp/ })).toHaveCount(0);
    await expect(page.getByTitle("Mapa de Consultorios Horizonte")).toHaveCount(0);
    await expect(page.getByText("WhatsApp", { exact: true })).toHaveCount(0);
  } finally {
    await updateBusiness(String(original.id), { whatsapp_phone: original.whatsapp_phone, public_address: original.public_address });
  }
});

test("dashboard responsive y navegación móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await expect(page.getByRole("navigation", { name: "Navegación del negocio" })).toBeVisible();
  await page.getByRole("link", { name: "Agenda", exact: true }).click();
  await expect(page).toHaveURL("/negocio/agenda");
  await expect(page.getByRole("button", { name: "Día" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Nuevo turno" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo turno" })).toBeVisible();
});

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
    const incompleteSignature = createHmac("sha256", "e2e-webhook-secret")
      .update(`id:123456;ts:${timestamp};`)
      .digest("hex");
    const incompleteWebhook = await request.post("/api/mercadopago/webhook?data.id=123456", {
      data: simulatedBody,
      headers: { "x-signature": `ts=${timestamp},v1=${incompleteSignature}` },
    });
    expect(incompleteWebhook.status()).toBe(401);

    const requestId = "e2e-signature-check";
    const signature = createHmac("sha256", "e2e-webhook-secret")
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
