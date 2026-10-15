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
  // Fuera de producción no hay subdominios: la canonical apunta a /b/<slug> del origen del deployment.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/b\/citadely-demo-ux$/);
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
  expect(sitemapBody).toContain("/b/citadely-demo-ux");
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
  await serviceDialog.locator('input[type="time"]').fill("12:00");
  await serviceDialog.getByRole("button", { name: "Agregar" }).click();
  await expect(serviceDialog.getByText("12:00")).toBeVisible();
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
  await appointmentDialog.getByRole("button", { name: new RegExp(serviceName) }).click();
  await appointmentDialog.getByRole("button", { name: /^11:00/ }).click();
  await appointmentDialog.getByRole("button", { name: "Seleccionar cliente" }).click();
  const clientPicker = page.getByRole("dialog", { name: "Seleccionar cliente" });
  const clientSearch = clientPicker.getByRole("searchbox", { name: "Buscar clientes" });
  for (const query of [clientName, `cliente-${runId}@example.com`, "1122334455"]) {
    await clientSearch.fill(query);
    await expect(clientPicker.getByRole("button", { name: clientName })).toBeVisible();
  }
  await clientSearch.fill("sin-coincidencias-e2e");
  await expect(clientPicker.getByText("No encontramos coincidencias")).toBeVisible();
  await clientSearch.fill(clientName);
  await clientPicker.getByRole("button", { name: clientName }).click();
  await expect(clientPicker).toBeHidden();
  await expect(appointmentDialog.getByRole("button", { name: clientName })).toBeVisible();
  await expect(appointmentDialog.getByRole("button", { name: /^11:00/ })).toHaveAttribute("aria-pressed", "true");
  await appointmentDialog.getByRole("button", { name: clientName }).click();
  await clientPicker.getByRole("button", { name: "Crear nuevo cliente" }).click();
  const quickClientDialog = page.getByRole("dialog", { name: "Nuevo cliente" });
  const quickClientName = `Cliente rápido E2E ${runId}`;
  await quickClientDialog.getByLabel("Nombre").fill(quickClientName);
  await quickClientDialog.getByLabel("Email").fill(`rapido-${runId}@example.com`);
  await quickClientDialog.getByLabel("Teléfono").fill("1199776655");
  await quickClientDialog.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(quickClientDialog).toBeHidden();
  await expect(appointmentDialog.getByRole("button", { name: quickClientName })).toBeVisible();
  await expect(appointmentDialog.getByRole("button", { name: /^11:00/ })).toHaveAttribute("aria-pressed", "true");
  await appointmentDialog.getByRole("button", { name: "Guardar turno" }).click();
  await expect(appointmentDialog).toBeHidden();

  await page.getByLabel("Filtrar por estado").selectOption("available");
  await page.getByRole("button", { name: /Turno libre a las 12:00/ }).click();
  const agendaAssignment = page.getByRole("dialog", { name: "Nuevo turno" });
  await expect(agendaAssignment).toContainText("Asigná este horario libre a un cliente.");
  await expect(agendaAssignment.getByText(/12:00/)).toBeVisible();
  await expect(agendaAssignment.getByRole("button", { name: new RegExp(serviceName) })).toHaveAttribute("aria-pressed", "true");
  await agendaAssignment.getByRole("button", { name: "Seleccionar cliente" }).click();
  await page.getByRole("dialog", { name: "Seleccionar cliente" }).getByRole("button", { name: clientName }).click();
  await agendaAssignment.getByRole("button", { name: "Guardar turno" }).click();
  await expect(agendaAssignment).toBeHidden();
  await expect(page.getByRole("button", { name: /Turno libre a las 12:00/ })).toHaveCount(0);
  await expect(page.getByLabel("Filtrar por estado")).toHaveValue("available");
  await expect(page.getByLabel("Filtrar por servicio").locator("option:checked")).toHaveText(serviceName);

  const businessRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=id&limit=1")).json() as { id: string }[];
  const serviceRows = await (await adminRequest(`records/services?business_id=eq.${businessRows[0].id}&name=eq.${encodeURIComponent(serviceName)}&select=id&limit=1`)).json() as { id: string }[];
  const denseSlots = [0, 15, 30].map((minute) => {
    const startsAt = new Date(availabilityDate);
    startsAt.setHours(13, minute, 0, 0);
    return { business_id: businessRows[0].id, service_id: serviceRows[0].id, starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 45 * 60_000).toISOString(), is_active: true };
  });
  await adminRequest("records/service_availability_slots", { method: "POST", body: JSON.stringify(denseSlots) });
  await page.reload();
  await page.getByRole("button", { name: "Día" }).click();
  for (let day = 0; day < 7; day += 1) await page.getByRole("button", { name: "Período siguiente" }).click();
  await page.getByLabel("Filtrar por servicio").selectOption({ label: serviceName });
  await page.getByLabel("Filtrar por estado").selectOption("available");
  await page.getByRole("button", { name: /3 horarios libres entre 13:00 y 14:00/ }).click();
  await page.getByRole("button", { name: /Asignar turno libre a las 13:15/ }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo turno" }).getByText(/13:15/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Nuevo turno" })).toBeHidden();
  await expect(page.getByLabel("Filtrar por estado")).toHaveValue("available");

  await page.getByLabel("Filtrar por servicio").selectOption("all");
  await page.getByRole("button", { name: /Turno libre a las 17:00/ }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo turno" }).getByText(/17:00/)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Nuevo turno" }).getByRole("group", { name: "Servicios disponibles" }).getByRole("button")).toHaveCount(4);
  await page.getByRole("dialog", { name: "Nuevo turno" }).getByRole("button", { name: "Cerrar panel" }).click();

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
  await expect(page.getByLabel("Información del servicio").getByText("Av. Corrientes 1234, Ciudad Autónoma de Buenos Aires", { exact: true })).toBeVisible();
  await expect(page.getByTitle("Mapa de Consultorios Horizonte")).toHaveAttribute("src", /maps\.google\.com\/maps\?q=Av\.%20Corrientes%201234/);
  await expect(page.getByRole("heading", { name: "Galería", exact: true })).toBeVisible();
  const publicHeadings = await page.locator("h2").allTextContents();
  expect(publicHeadings.indexOf("Galería")).toBeLessThan(publicHeadings.indexOf("Información del servicio"));
  await expect(page.getByRole("heading", { name: "Preguntas frecuentes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "¿Cómo solicito mi turno?" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Elegí un servicio y uno de los horarios disponibles.")).toBeVisible();
  const publicService = page.getByRole("button", { name: new RegExp(serviceName) });
  await publicService.click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^13:15/ })).toBeVisible();
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

test("cupos por horario: reservas públicas, email único, Agenda y liberación", async ({ page, request }) => {
  test.setTimeout(150_000);
  const runId = Date.now().toString(36);
  const serviceName = `Curso grupal E2E ${runId}`;
  const date = new Date();
  date.setMonth(date.getMonth() + 4, 10);
  date.setHours(18, 0, 0, 0);
  const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const firstEmail = `grupo-a-${runId}@example.com`;
  const secondEmail = `grupo-b-${runId}@example.com`;

  await signIn(page);
  await page.goto("/negocio/servicios?nuevo=1");
  const drawer = page.getByRole("dialog", { name: "Nuevo servicio" });
  await drawer.getByLabel("Nombre").fill(serviceName);
  await drawer.getByLabel("Duración en minutos").fill("60");
  await drawer.getByLabel("Cobro al reservar").selectOption("free");
  await drawer.getByLabel("Mes").selectOption(monthValue);
  await drawer.getByRole("button", { name: /^10(?:\D|$)/ }).first().click();
  await drawer.locator('input[type="time"]').fill("18:00");
  await drawer.getByRole("button", { name: "Agregar" }).click();
  await drawer.getByLabel("Cupo").fill("3");
  await drawer.getByRole("button", { name: "Guardar servicio" }).click();
  await expect(drawer).toBeHidden();

  await page.goto("/b/citadely-demo-ux");
  await page.getByRole("button", { name: new RegExp(serviceName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  const timeButton = page.getByRole("button", { name: /^18:00/ });
  await expect(timeButton).toHaveAttribute("aria-label", "18:00, 3 de 3 cupos disponibles");
  await timeButton.hover();
  await expect(timeButton.getByText("3 de 3 cupos disponibles")).toBeVisible();

  async function reserve(name: string, email: string) {
    await timeButton.click();
    await page.getByLabel("Nombre y apellido").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Teléfono").fill("1199887766");
    await page.getByRole("button", { name: "Confirmar reserva" }).click();
  }

  await reserve("Participante Uno", firstEmail);
  await expect(page.getByText(/reserva confirmada/i)).toBeVisible();
  await expect(timeButton).toHaveAttribute("aria-label", "18:00, 2 de 3 cupos disponibles");
  await reserve("Participante Duplicado", firstEmail.toUpperCase());
  await expect(page.getByText(/este email ya tiene una reserva/i)).toBeVisible();
  await expect(timeButton).toHaveAttribute("aria-label", "18:00, 2 de 3 cupos disponibles");
  await reserve("Participante Dos", secondEmail);
  await expect(page.getByText(/reserva confirmada/i)).toBeVisible();
  await expect(timeButton).toHaveAttribute("aria-label", "18:00, 1 de 3 cupos disponibles");

  await page.goto("/negocio/agenda");
  await page.getByRole("button", { name: "Nuevo turno" }).click();
  const appointmentDrawer = page.getByRole("dialog", { name: "Nuevo turno" });
  await appointmentDrawer.getByRole("button", { name: new RegExp(serviceName) }).click();
  await appointmentDrawer.getByRole("button", { name: /^18:00/ }).click();
  await appointmentDrawer.getByRole("button", { name: "Seleccionar cliente" }).click();
  await page.getByRole("dialog", { name: "Seleccionar cliente" }).getByRole("button", { name: "Crear nuevo cliente" }).click();
  const clientDrawer = page.getByRole("dialog", { name: "Nuevo cliente" });
  await clientDrawer.getByLabel("Nombre").fill(`Participante Manual ${runId}`);
  await clientDrawer.getByLabel("Email").fill(`grupo-manual-${runId}@example.com`);
  await clientDrawer.getByRole("button", { name: "Guardar cliente" }).click();
  await appointmentDrawer.getByRole("button", { name: "Guardar turno" }).click();
  await expect(appointmentDrawer).toBeHidden();

  await page.goto("/b/citadely-demo-ux");
  await page.getByRole("button", { name: new RegExp(serviceName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^18:00/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^18:00/ })).toContainText("Completo");

  const services = await (await adminRequest(`records/services?name=eq.${encodeURIComponent(serviceName)}&select=id`)).json() as { id: string }[];
  const appointments = await (await adminRequest(`records/appointments?service_id=eq.${services[0].id}&select=id,source`)).json() as { id: string; source: string }[];
  expect(appointments).toHaveLength(3);
  await adminRequest(`records/appointments?id=eq.${appointments.find((appointment) => appointment.source === "public_booking")?.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  });
  await page.reload();
  await page.getByRole("button", { name: new RegExp(serviceName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^18:00/ })).toHaveAttribute("aria-label", "18:00, 1 de 3 cupos disponibles");

  const slotRows = await (await adminRequest(`records/service_availability_slots?service_id=eq.${services[0].id}&select=id`)).json() as { id: string }[];
  const businessRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=id&limit=1")).json() as { id: string }[];
  const payload = (suffix: string) => ({
    businessId: businessRows[0].id,
    serviceId: services[0].id,
    startsAt: date.toISOString(),
    clientName: `Simultáneo ${suffix}`,
    clientEmail: `simultaneo-${suffix}-${runId}@example.com`,
    clientPhone: "1199887766",
  });
  const results = await Promise.all(["a", "b"].map((suffix) => request.post("/api/public-booking", {
    data: payload(suffix),
  })));
  expect(results.filter((response) => response.ok())).toHaveLength(1);
  expect(results.filter((response) => response.status() === 409)).toHaveLength(1);
  await expect(adminRequest(`records/service_availability_slots?id=eq.${slotRows[0].id}`, {
    method: "PATCH", body: JSON.stringify({ capacity: 2 }),
  })).rejects.toThrow();
  await expect(adminRequest(`records/service_availability_slots?id=eq.${slotRows[0].id}`, {
    method: "DELETE",
  })).rejects.toThrow();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(serviceName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^18:00/ })).toBeDisabled();
});

test("una seña vencida libera plaza y otro servicio superpuesto queda bloqueado", async ({ page, request }) => {
  const runId = Date.now().toString(36);
  const businessRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=id&limit=1")).json() as { id: string }[];
  const businessId = businessRows[0].id;
  const date = new Date();
  date.setMonth(date.getMonth() + 5, 22);
  date.setHours(20, 0, 0, 0);
  const endsAt = new Date(date.getTime() + 60 * 60_000);
  const primaryName = `Taller con seña E2E ${runId}`;
  const otherName = `Servicio paralelo E2E ${runId}`;
  await adminRequest("records/services", { method: "POST", body: JSON.stringify([
    { business_id: businessId, name: primaryName, duration_minutes: 60, price_cents: 5000, requires_payment: true, deposit_type: "deposit", deposit_value_cents: 1000 },
    { business_id: businessId, name: otherName, duration_minutes: 60, price_cents: 0, requires_payment: false, deposit_type: "free", deposit_value_cents: 0 },
  ]) });
  const primaryRows = await (await adminRequest(`records/services?business_id=eq.${businessId}&name=eq.${encodeURIComponent(primaryName)}&select=id`)).json() as { id: string }[];
  const otherRows = await (await adminRequest(`records/services?business_id=eq.${businessId}&name=eq.${encodeURIComponent(otherName)}&select=id`)).json() as { id: string }[];
  const primaryId = primaryRows[0].id;
  const otherId = otherRows[0].id;
  await adminRequest("records/service_availability_slots", { method: "POST", body: JSON.stringify([
    { business_id: businessId, service_id: primaryId, starts_at: date.toISOString(), ends_at: endsAt.toISOString(), capacity: 2 },
    { business_id: businessId, service_id: otherId, starts_at: date.toISOString(), ends_at: endsAt.toISOString(), capacity: 1 },
  ]) });
  const booking = (serviceId: string, suffix: string) => request.post("/api/public-booking", { data: {
    businessId, serviceId, startsAt: date.toISOString(), clientName: `Cliente ${suffix}`,
    clientEmail: `senia-${suffix}-${runId}@example.com`, clientPhone: "1199887766",
  } });
  const first = await booking(primaryId, "uno");
  expect(first.ok()).toBe(true);
  expect((await first.json() as { status: string }).status).toBe("pending_payment");
  expect((await booking(otherId, "paralelo")).status()).toBe(409);

  const appointments = await (await adminRequest(`records/appointments?service_id=eq.${primaryId}&select=id`)).json() as { id: string }[];
  await adminRequest(`records/appointments?id=eq.${appointments[0].id}`, {
    method: "PATCH", body: JSON.stringify({ deposit_expires_at: new Date(Date.now() - 60_000).toISOString() }),
  });
  await page.goto("/b/citadely-demo-ux");
  await page.getByRole("button", { name: new RegExp(primaryName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^20:00/ })).toContainText("2 de 2 cupos disponibles");
  expect((await booking(otherId, "paralelo-despues")).ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: new RegExp(primaryName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^20:00/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^20:00/ })).toContainText("No disponible");
});

test("editar disponibilidad conserva horarios más allá de la primera página", async ({ page }) => {
  test.setTimeout(180_000);
  const businessRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=id&limit=1")).json() as { id: string }[];
  const serviceRows = await (await adminRequest(`records/services?business_id=eq.${businessRows[0].id}&name=eq.${encodeURIComponent("Consulta inicial")}&select=id&limit=1`)).json() as { id: string }[];
  const serviceId = serviceRows[0].id;
  const firstDate = new Date();
  firstDate.setMonth(firstDate.getMonth() + 2, 1);
  firstDate.setHours(9, 0, 0, 0);
  const slots = Array.from({ length: 1001 }, (_, index) => {
    const startsAt = new Date(firstDate);
    startsAt.setDate(firstDate.getDate() + Math.floor(index / 16));
    startsAt.setHours(9 + Math.floor((index % 16) / 2), (index % 2) * 30, 0, 0);
    return {
      business_id: businessRows[0].id,
      service_id: serviceId,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 45 * 60_000).toISOString(),
      is_active: true,
    };
  });
  const lastDate = new Date(slots[slots.length - 1].starts_at);
  const monthValue = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}`;
  const addedStart = new Date(lastDate);
  addedStart.setHours(17, 30, 0, 0);

  try {
    for (let index = 0; index < slots.length; index += 200) {
      await adminRequest("records/service_availability_slots", { method: "POST", body: JSON.stringify(slots.slice(index, index + 200)) });
    }

    await signIn(page);
    await page.goto("/negocio/servicios");
    await page.getByRole("button", { name: "Editar Consulta inicial" }).click();
    const drawer = page.getByRole("dialog", { name: "Editar servicio" });
    await drawer.getByLabel("Mes").selectOption(monthValue);
    await drawer.getByRole("button", { name: new RegExp(`^${lastDate.getDate()}(?:\\D|$)`) }).first().click();
    await expect(drawer.getByText("09:00", { exact: true })).toBeVisible();
    await drawer.locator('input[type="time"]').fill("17:30");
    await drawer.getByRole("button", { name: "Agregar" }).click();
    await adminRequest("records/service_availability_slots", { method: "POST", body: JSON.stringify([{
      business_id: businessRows[0].id,
      service_id: serviceId,
      starts_at: addedStart.toISOString(),
      ends_at: new Date(addedStart.getTime() + 45 * 60_000).toISOString(),
      is_active: true,
    }]) });
    await drawer.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(drawer).toBeHidden();

    const addedRows = await (await adminRequest(`records/service_availability_slots?service_id=eq.${serviceId}&starts_at=eq.${encodeURIComponent(addedStart.toISOString())}&select=id`)).json() as { id: string }[];
    expect(addedRows).toHaveLength(1);
  } finally {
    const firstStart = slots[0].starts_at;
    const lastEnd = new Date(lastDate);
    lastEnd.setHours(18, 0, 0, 0);
    await adminRequest(`records/service_availability_slots?service_id=eq.${serviceId}&starts_at=gte.${encodeURIComponent(firstStart)}&starts_at=lt.${encodeURIComponent(lastEnd.toISOString())}`, { method: "DELETE" });
  }
});

test("RPC de turnos manuales: propiedad, inserción directa y concurrencia", async () => {
  const result = execFileSync(process.execPath, ["--env-file=.env.local", "--input-type=module", "-e", `
    import { createClient } from "@insforge/sdk";
    import { randomUUID } from "node:crypto";
    const makeClient = () => createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
    const first = makeClient();
    const second = makeClient();
    const credentials = { email: process.env.CITADELY_DEMO_EMAIL, password: process.env.CITADELY_DEMO_PASSWORD };
    const logins = await Promise.all([first.auth.signInWithPassword(credentials), second.auth.signInWithPassword(credentials)]);
    if (logins.some((login) => login.error)) throw new Error("Demo login failed");
    const { data: business } = await first.database.from("businesses").select("id").eq("slug", "citadely-demo-ux").single();
    const { data: client } = await first.database.from("clients").select("id").eq("business_id", business.id).limit(1).single();
    const target = new Date();
    target.setDate(target.getDate() + 8);
    while (target.getDay() === 0 || target.getDay() === 6) target.setDate(target.getDate() + 1);
    target.setHours(17, 0, 0, 0);
    const { data: slots } = await first.database.from("service_availability_slots").select("service_id,starts_at,ends_at").eq("business_id", business.id).eq("starts_at", target.toISOString()).limit(1);
    if (slots?.length !== 1) throw new Error("Test slot missing");
    const slot = slots[0];
    const payload = { p_business_id: business.id, p_client_id: client.id, p_service_id: slot.service_id, p_starts_at: slot.starts_at };
    const anonymous = await makeClient().database.rpc("create_manual_appointment", payload);
    const foreign = await first.database.rpc("create_manual_appointment", { ...payload, p_business_id: randomUUID() });
    const direct = await first.database.from("appointments").insert([{ business_id: business.id, client_id: client.id, service_id: slot.service_id, starts_at: slot.starts_at, ends_at: slot.ends_at, status: "confirmed", source: "business" }]);
    const results = await Promise.all([first.database.rpc("create_manual_appointment", payload), second.database.rpc("create_manual_appointment", payload)]);
    const { data: created } = await first.database.from("appointments").select("id").eq("business_id", business.id).eq("starts_at", slot.starts_at);
    process.stdout.write(JSON.stringify({ anonymousDenied: !!anonymous.error, foreignDenied: /no autorizado/i.test(foreign.error?.message ?? ""), directDenied: !!direct.error, successes: results.filter((item) => !item.error).length, conflict: results.some((item) => /ocupado|cupos|superpone/i.test(item.error?.message ?? "")), count: created?.length }));
  `], { cwd: process.cwd(), encoding: "utf8", timeout: 60_000 });
  expect(JSON.parse(result)).toEqual({ anonymousDenied: true, foreignDenied: true, directDenied: true, successes: 1, conflict: true, count: 1 });
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
  await page.getByRole("dialog", { name: "Nuevo turno" }).getByRole("button", { name: "Seleccionar cliente" }).click();
  const clientPicker = page.getByRole("dialog", { name: "Seleccionar cliente" });
  await expect(clientPicker.getByRole("table")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(clientPicker).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Nuevo turno" }).getByRole("button", { name: "Seleccionar cliente" })).toBeFocused();
  await page.getByRole("dialog", { name: "Nuevo turno" }).getByRole("button", { name: "Cerrar panel" }).click();
  const nextWeekday = new Date();
  let daysAhead = 0;
  do { daysAhead += 1; nextWeekday.setDate(nextWeekday.getDate() + 1); } while (nextWeekday.getDay() === 0 || nextWeekday.getDay() === 6);
  for (let day = 0; day < daysAhead; day += 1) await page.getByRole("button", { name: "Período siguiente" }).click();
  await page.getByLabel("Filtrar por estado").selectOption("available");
  await page.getByRole("button", { name: /Turno libre a las 17:00/ }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo turno" })).toContainText("Asigná este horario libre a un cliente.");
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
