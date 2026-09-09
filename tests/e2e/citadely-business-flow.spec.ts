import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

function readLocalCredential(name: string) {
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((candidate) => candidate.startsWith(`${name}=`));
  if (!line) throw new Error(`Falta ${name} en .env.local. Ejecutá pnpm seed:demo.`);
  return line.slice(name.length + 1);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(readLocalCredential("CITADELY_DEMO_EMAIL"));
  await page.getByLabel("Contraseña").fill(readLocalCredential("CITADELY_DEMO_PASSWORD"));
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/negocio/);
  await expect(page.getByText("Consultorios Horizonte").first()).toBeVisible();
}

test.beforeAll(() => {
  execFileSync(process.execPath, ["scripts/seed-citadely-demo.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, SEED_ALLOW_WRITE: "true" },
    stdio: "pipe",
    timeout: 120_000,
  });
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
  await page.getByLabel("Filtrar por servicio").selectOption({ label: serviceName });
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
