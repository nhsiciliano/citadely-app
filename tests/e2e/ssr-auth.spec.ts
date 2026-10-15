import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { assertBackendBranch, readLinkedProject } from "../../scripts/lib/seed-guard.mjs";

// Sesión en cookies y panel protegido en el servidor (5.2). Usa su propio usuario y negocio.

const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
const businessName = `Estudio SSR ${runId}`;
const email = `ssr-${runId}@citadely.test`;
const password = `Ssr-${randomUUID()}`;
const pendingEmail = `ssr-pending-${runId}@citadely.test`;
const userIds: string[] = [];
let businessId = "";

function env(name: string) {
  if (process.env[name]) return process.env[name] as string;
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((candidate) => candidate.startsWith(`${name}=`));
  if (!line) throw new Error(`Falta ${name}.`);
  return line.slice(name.length + 1);
}

async function admin(path: string, init?: RequestInit) {
  const project = readLinkedProject() as { oss_host: string; api_key: string };
  assertBackendBranch(project);
  const response = await fetch(`${project.oss_host}/api/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${project.api_key}`, "x-api-key": project.api_key, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`InsForge ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response;
}

async function createUser(userEmail: string, profile: Record<string, unknown>) {
  await admin("auth/users?client_type=server", {
    method: "POST",
    body: JSON.stringify({ email: userEmail, password, name: "SSR E2E", autoConfirm: true }),
  });
  // Import dinámico: el SDK es solo ESM y el loader de Playwright resolvería el import estático con require.
  const { createClient } = await import("@insforge/sdk");
  const client = createClient({ baseUrl: env("NEXT_PUBLIC_INSFORGE_BASE_URL"), anonKey: env("NEXT_PUBLIC_INSFORGE_ANON_KEY") });
  const { data, error } = await client.auth.signInWithPassword({ email: userEmail, password });
  if (error || !data?.user) throw new Error(`No se pudo iniciar sesión: ${error?.message ?? "sin usuario"}`);
  userIds.push(data.user.id);
  const profileResult = await client.auth.setProfile(profile);
  if (profileResult.error) throw new Error(profileResult.error.message);
  return { client, userId: data.user.id };
}

async function login(page: Page, userEmail = email) {
  await page.getByLabel("Email").fill(userEmail);
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

async function signIn(page: Page) {
  await page.goto("/login");
  await login(page);
  await expect(page).toHaveURL(/\/negocio$/);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { client, userId } = await createUser(email, { role: "business", onboarding_complete: true, business_name: businessName });
  const created = await client.database.from("businesses")
    .insert([{ owner_id: userId, name: businessName, slug: `ssr-${runId}` }])
    .select("id").single();
  if (created.error) throw new Error(created.error.message);
  businessId = (created.data as { id: string }).id;
  await createUser(pendingEmail, { role: "business", onboarding_complete: false });
});

test.afterAll(async () => {
  if (businessId) await admin(`database/records/businesses?id=eq.${businessId}`, { method: "DELETE" }).catch(() => undefined);
  if (userIds.length) await admin("auth/users", { method: "DELETE", body: JSON.stringify({ userIds }) }).catch(() => undefined);
});

test("sin sesión, el panel redirige en el servidor sin enviar el dashboard", async ({ request }) => {
  for (const path of ["/negocio", "/negocio/agenda", "/onboarding"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers().location, path).toBe(`/login?next=${encodeURIComponent(path)}`);
    expect(await response.text(), path).not.toContain("Navegación del negocio");
  }
});

test("el login deja la sesión en cookies y el panel llega renderizado desde el servidor", async ({ page }) => {
  await page.goto("/login");
  await login(page);
  await expect(page).toHaveURL(/\/negocio$/);
  await expect(page.getByText(businessName).first()).toBeVisible();

  const cookies = await page.context().cookies();
  const access = cookies.find((cookie) => cookie.name === "insforge_access_token");
  const refresh = cookies.find((cookie) => cookie.name === "insforge_refresh_token");
  expect(access?.httpOnly).toBe(false);
  expect(refresh?.httpOnly).toBe(true);
  expect(refresh?.sameSite).toBe("Lax");

  // El HTML inicial ya trae el panel con los datos del negocio: no hay pantalla de carga en el cliente.
  const html = await (await page.request.get("/negocio/agenda")).text();
  expect(html).toContain(businessName);
  expect(html).toContain("Navegación del negocio");
  expect(html).not.toContain("Preparando tu central de turnos");
});

test("con el access token vencido el proxy lo renueva con la refresh cookie", async ({ page }) => {
  await signIn(page);
  const before = (await page.context().cookies()).find((cookie) => cookie.name === "insforge_access_token");
  await page.context().clearCookies({ name: "insforge_access_token" });

  const response = await page.request.get("/negocio/servicios", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  const setCookie = response.headersArray().filter((header) => header.name.toLowerCase() === "set-cookie").map((header) => header.value).join("\n");
  expect(setCookie).toContain("insforge_access_token=");
  expect(await response.text()).toContain(businessName);

  await page.goto("/negocio/clientes");
  await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible();
  const after = (await page.context().cookies()).find((cookie) => cookie.name === "insforge_access_token");
  expect(after?.value).toBeTruthy();
  expect(after?.value).not.toBe(before?.value);
});

test("cerrar sesión borra las cookies y vuelve a exigir login", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const names = (await page.context().cookies()).map((cookie) => cookie.name);
  expect(names).not.toContain("insforge_access_token");
  expect(names).not.toContain("insforge_refresh_token");

  const response = await page.request.get("/negocio", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
});

test("después del login vuelve a la página del panel que se pidió", async ({ page }) => {
  await page.goto("/negocio/agenda");
  await expect(page).toHaveURL(/\/login\?next=%2Fnegocio%2Fagenda$/);
  await login(page);
  await expect(page).toHaveURL(/\/negocio\/agenda$/);
  await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
});

test("un usuario sin onboarding completo va a /onboarding, no al panel", async ({ page }) => {
  await page.goto("/login");
  await login(page, pendingEmail);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.goto("/negocio");
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("el cliente del navegador renueva el access token por /api/auth/refresh", async ({ page }) => {
  await signIn(page);
  await page.context().clearCookies({ name: "insforge_access_token" });

  const status = await page.evaluate(async () => (await fetch("/api/auth/refresh", { method: "POST" })).status);
  expect(status).toBe(200);
  expect((await page.context().cookies()).some((cookie) => cookie.name === "insforge_access_token" && cookie.value)).toBe(true);

  await page.context().clearCookies();
  expect(await page.evaluate(async () => (await fetch("/api/auth/refresh", { method: "POST" })).status)).toBe(401);
});
