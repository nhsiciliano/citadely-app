import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const authConfigPath = join(process.cwd(), ".playwright-auth-config.toml");

function applyEmailVerificationConfig(enabled: boolean) {
  writeFileSync(authConfigPath, `[auth]\nrequire_email_verification = ${enabled}\n`);
  execFileSync("npx", ["@insforge/cli", "config", "apply", "--file", authConfigPath, "--auto-approve"], {
    cwd: process.cwd(),
    stdio: "pipe",
    timeout: 120_000,
  });
}

test.beforeAll(() => {
  applyEmailVerificationConfig(false);
});

test.afterAll(() => {
  applyEmailVerificationConfig(true);
});

function uniqueRunId() {
  return Date.now().toString(36);
}

test("business onboarding, dashboard CRUD, and public booking", async ({ page }) => {
  const runId = uniqueRunId();
  const email = `citadely-${runId}@example.com`;
  const password = `Citadely${runId}123`;
  const businessName = `Barberia Playwright ${runId}`;
  const businessSlug = `barberia-playwright-${runId}`;
  const serviceName = `Consulta inicial ${runId}`;
  const clientName = `Cliente Dashboard ${runId}`;
  const publicClientName = `Cliente Publico ${runId}`;
  const appointmentDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  appointmentDate.setHours(11, 0, 0, 0);
  const appointmentLocalValue = appointmentDate.toISOString().slice(0, 16);
  const availabilityDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const availabilityMonthValue = `${availabilityDate.getFullYear()}-${String(availabilityDate.getMonth() + 1).padStart(2, "0")}`;
  const availabilityDay = String(availabilityDate.getDate()).padStart(2, "0");

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /gestiona citas/i })).toBeVisible();

  await page.getByRole("link", { name: "Crear cuenta" }).first().click();
  await expect(page.getByRole("heading", { name: "Crea tu cuenta" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cliente" })).toHaveCount(0);
  await expect(page.getByText("Soy cliente")).toHaveCount(0);
  await page.getByLabel("Nombre").fill(`Usuario ${runId}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contrasena").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByText("Soy cliente")).toHaveCount(0);
  await expect(page.getByText("Tipo de cuenta")).toHaveCount(0);
  await page.getByLabel("Nombre del negocio").fill(businessName);
  await page.getByLabel("Rubro").selectOption("barberia");
  await page.getByLabel("URL publica").fill(businessSlug);
  await page.getByRole("button", { name: "Guardar y continuar" }).click();

  await expect(page).toHaveURL(/\/negocio/);
  await expect(page.getByRole("heading", { name: businessName })).toBeVisible();
  await expect(page.getByText(/7 dias de uso gratuito/i)).toBeVisible();
  await expect(page.getByText(`${businessSlug}.citadely.com.ar`)).toBeVisible();

  await expect(page.getByText("Disponibilidad pública de reservas")).toHaveCount(0);

  await page.getByLabel("Alias").fill(`citadely.${runId}`);
  await page.getByLabel("CBU/CVU").fill("0000003100012345678901");
  await page.getByLabel("Instrucciones de pago").fill("Enviar comprobante por WhatsApp.");
  await page.getByRole("button", { name: "Guardar datos de seña" }).click();
  await expect(page.getByText(/datos de transferencia guardados/i)).toBeVisible();

  await page.getByLabel("Nombre").first().fill(serviceName);
  await page.getByLabel("Descripción detallada").fill("Servicio creado por prueba E2E");
  await page.getByLabel("Imagen del servicio").fill("https://images.unsplash.com/photo-1505751172876-fa1923c5c528");
  await page.getByLabel("Duracion en minutos").fill("30");
  await page.getByLabel("Precio").fill("12000");
  await page.getByLabel("Cobro al reservar").selectOption("free");
  await page.getByLabel("Mes").selectOption(availabilityMonthValue);
  await page.locator("#servicios").getByRole("button", { name: new RegExp(`^${availabilityDay}`) }).first().click();
  await page.locator("#servicios input[type=\"time\"]").fill("10:00");
  await page.getByRole("button", { name: "Agregar hora" }).click();
  await expect(page.locator("#servicios").getByText("10:00 x")).toBeVisible();
  await page.getByRole("button", { name: "Agregar servicio" }).click();
  await expect(page.locator("#servicios").getByText(serviceName)).toBeVisible();
  await expect(page.getByText(/servicio y disponibilidad mensual guardados/i)).toBeVisible();

  const clientsPanel = page.locator("#clientes");
  await clientsPanel.getByLabel("Nombre").fill(clientName);
  await clientsPanel.getByLabel("Email").fill(`cliente-${runId}@example.com`);
  await clientsPanel.getByLabel("Telefono").fill("1122334455");
  await page.getByRole("button", { name: "Agregar cliente" }).click();
  await expect(clientsPanel.getByText(clientName)).toBeVisible();

  const agendaPanel = page.locator("#agenda");
  await agendaPanel.getByLabel("Cliente").selectOption({ label: clientName });
  await agendaPanel.getByLabel("Servicio").selectOption({ label: serviceName });
  await agendaPanel.getByLabel("Fecha y hora").fill(appointmentLocalValue);
  await page.getByRole("button", { name: "Crear cita" }).click();
  await expect(page.getByText(serviceName).last()).toBeVisible();

  await page.goto(`/b/${businessSlug}`);
  await expect(page.getByRole("heading", { name: businessName })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(serviceName) })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crear cuenta" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ingresar" })).toHaveCount(0);
  await page.getByRole("button", { name: new RegExp(serviceName) }).click();
  await expect(page.getByText(/turnos/i).first()).toBeVisible();
  await page.getByRole("button", { name: /10:00/ }).first().click();
  await expect(page.getByLabel("Nombre y apellido")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Teléfono")).toBeVisible();
  await page.getByLabel("Nombre y apellido").fill(publicClientName);
  await page.getByLabel("Email").fill(`publico-${runId}@example.com`);
  await page.getByLabel("Nota para el negocio").fill("Reserva generada por Playwright");
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByLabel("Teléfono")).toBeFocused();
  await page.getByLabel("Teléfono").fill("1199887766");
  await page.getByLabel("Nota para el negocio").fill("Reserva generada por Playwright");
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByText(/reserva confirmada/i)).toBeVisible();

  await page.goto("/negocio");
  await expect(
    agendaPanel.getByRole("paragraph").filter({ hasText: publicClientName }),
  ).toBeVisible();

  await page.goto("/cliente");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Portal cliente")).toHaveCount(0);
});
