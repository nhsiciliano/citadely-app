import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { admin, env } from "./support/backend";

// El onboarding guarda el negocio y navega al panel (H1). Usa su propio usuario y negocio.

const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
const businessName = `Onboarding ${runId}`;
const email = `onb-${runId}@citadely.test`;
const password = `Onb-${randomUUID()}`;
const userIds: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await admin("auth/users?client_type=server", {
    method: "POST",
    body: JSON.stringify({ email, password, name: "Onboarding E2E", autoConfirm: true }),
  });
  // Import dinámico: el SDK es solo ESM y el loader de Playwright resolvería el import estático con require.
  const { createClient } = await import("@insforge/sdk");
  const client = createClient({ baseUrl: env("NEXT_PUBLIC_INSFORGE_BASE_URL"), anonKey: env("NEXT_PUBLIC_INSFORGE_ANON_KEY") });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user) throw new Error(`No se pudo iniciar sesión: ${error?.message ?? "sin usuario"}`);
  userIds.push(data.user.id);
  const profileResult = await client.auth.setProfile({ role: "business", onboarding_complete: false });
  if (profileResult.error) throw new Error(profileResult.error.message);
});

test.afterAll(async () => {
  if (!userIds.length) return;
  const rows = await (await admin(`database/records/businesses?owner_id=in.(${userIds.join(",")})`)).json() as { id: string }[];
  for (const row of rows) await admin(`database/records/businesses?id=eq.${row.id}`, { method: "DELETE" }).catch(() => undefined);
  await admin("auth/users", { method: "DELETE", body: JSON.stringify({ userIds }) }).catch(() => undefined);
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test("guardar el negocio navega al panel", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });

  // loadUser() resetea los campos al terminar de leer el perfil: esperar el botón habilitado antes de escribir.
  const submit = page.getByRole("button", { name: "Guardar y continuar" });
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await page.getByLabel(/Nombre del negocio/i).fill(businessName);
  await expect(page.getByLabel(/URL pública/i)).toHaveValue(`onboarding-${runId}`);
  await page.locator("select[name=business_category]").selectOption({ index: 1 });
  await expect(page.getByText("Disponible.")).toBeVisible({ timeout: 15_000 });
  await submit.click();

  await expect(page).toHaveURL(/\/negocio$/, { timeout: 30_000 });
  await expect(page.getByText(businessName).first()).toBeVisible();
});

test("un dueño con negocio que vuelve a /onboarding termina en el panel", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/negocio$/, { timeout: 30_000 });
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/negocio$/);
});
