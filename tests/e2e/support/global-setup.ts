import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";
import { branchProject, env } from "./backend";
import { loadE2eEnvironment } from "./env";

// Runs once before the suite: refuses non-branch targets, then (re)creates the demo business the dashboard
// and booking specs rely on. The seed resets the demo data every time, so running it again is safe.
export default async function globalSetup() {
  loadE2eEnvironment();
  const project = branchProject();
  console.log(`E2E → backend branch "${project.projectName}" (derivado de "${project.parentName}"), corrida ${env("E2E_RUN_ID")}`);

  // The suite writes data: the operator must confirm the target by exporting its exact name (same rule as the seeds).
  if (process.env.SEED_CONFIRM_PROJECT !== project.projectName) {
    throw new Error(`Los E2E escriben datos en "${project.projectName}". Para confirmar, definí SEED_CONFIRM_PROJECT=${project.projectName}.`);
  }

  if (process.env.E2E_SKIP_SEED !== "1") {
    execFileSync(process.execPath, ["scripts/seed-citadely-demo.mjs"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "pipe",
      timeout: 180_000,
    });

    // The seed creates the demo credentials in .env.local when they are not provided by the environment.
    if (existsSync(".env.local")) process.loadEnvFile(".env.local");
    env("CITADELY_DEMO_EMAIL");
    env("CITADELY_DEMO_PASSWORD");
  }

  await warmUpDevServer();
}

// A cold `next dev` compiles each route on its first request, and the workers would otherwise pay that cost
// while the first login waits. The public pages are requested anonymously; the dashboard routes are only served
// to a signed-in owner (the proxy redirects otherwise before the page compiles), so this signs in once and asks for
// each dashboard route with that session. Failures are logged, never thrown: the warm-up only triggers compilation.
const BASE_URL = "http://127.0.0.1:3002";
const PUBLIC_WARM_UP_PATHS = ["/login", "/b/citadely-demo-ux"];
const DASHBOARD_WARM_UP_PATHS = ["/negocio", "/negocio/agenda", "/negocio/servicios", "/negocio/clientes", "/negocio/pagina-publica", "/negocio/configuracion"];

async function warmUpDevServer() {
  for (const path of PUBLIC_WARM_UP_PATHS) {
    await warmUpRequest(path, () => fetch(`${BASE_URL}${path}`, { redirect: "manual", signal: AbortSignal.timeout(120_000) }).then((response) => response.status));
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    await page.goto("/login", { timeout: 120_000 });
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email").fill(env("CITADELY_DEMO_EMAIL"));
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(env("CITADELY_DEMO_PASSWORD"));
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(/\/negocio/, { timeout: 120_000 });
    for (const path of DASHBOARD_WARM_UP_PATHS) {
      await warmUpRequest(path, () => context.request.get(path, { timeout: 120_000 }).then((response) => response.status()));
    }
  } catch (error) {
    console.log(`warm-up de sesión no completó: ${error instanceof Error ? error.message : error}`);
  } finally {
    await browser.close();
  }
}

async function warmUpRequest(path: string, request: () => Promise<number>) {
  const started = Date.now();
  try {
    console.log(`warm-up ${path} → ${await request()} (${Date.now() - started} ms)`);
  } catch (error) {
    console.log(`warm-up ${path} → no respondió: ${error instanceof Error ? error.message : error}`);
  }
}
