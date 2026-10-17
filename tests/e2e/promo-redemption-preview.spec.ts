import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { branchProject, env } from "./support/backend";

test.skip(process.env.RUN_PROMO_REDEMPTION !== "1", "Prueba de escritura aislada: ejecutar solo contra InsForge Preview.");

test("canje real tras prueba Pro, persistencia y limpieza de datos E2E", async ({ page, request }) => {
  // Opt-in (RUN_PROMO_REDEMPTION=1) because it changes the demo business trial. E2E_PROMO_BRANCH restricts the
  // run to one named backend branch; the backend-branch guard in branchProject() always applies.
  const target = branchProject();
  const allowedBranch = process.env.E2E_PROMO_BRANCH;
  if (allowedBranch && target.projectName !== allowedBranch) {
    throw new Error(`La prueba solo puede ejecutarse en ${allowedBranch} (backend actual: ${target.projectName}).`);
  }
  const project = { oss_host: target.ossHost, api_key: target.apiKey };
  const adminPassword = env("E2E_ADMIN_PASSWORD");

  const headers = { Authorization: `Bearer ${project.api_key}`, "x-api-key": project.api_key, "Content-Type": "application/json" };
  const businessResponse = await fetch(`${project.oss_host}/api/database/records/businesses?slug=eq.citadely-demo-ux&select=id,trial_ends_at,promotion_ends_at`, { headers });
  const businesses = await businessResponse.json() as Array<{ id: string; trial_ends_at: string; promotion_ends_at: string | null }>;
  const business = businesses[0];
  if (!businessResponse.ok || !business || business.promotion_ends_at) throw new Error("Cuenta demo no apta para prueba de canje.");

  let code = "";
  try {
    const login = await request.post("/admin-panel/api/session", {
      headers: { Origin: "http://127.0.0.1:3002", "x-real-ip": "e2e-promo-redemption" },
      data: { username: "admin", password: adminPassword },
    });
    expect(login.ok()).toBeTruthy();
    const created = await request.post("/admin-panel/api/promo-codes", {
      headers: { Origin: "http://127.0.0.1:3002" }, data: { durationDays: 30, maxUses: 1 },
    });
    expect(created.status()).toBe(201);
    code = ((await created.json()) as { code: string }).code;

    await page.goto("/login");
    await page.getByLabel("Email").fill(env("CITADELY_DEMO_EMAIL"));
    await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(env("CITADELY_DEMO_PASSWORD"));
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/negocio/);
    await page.goto("/negocio/configuracion");
    await page.getByLabel("Ingresá tu código").fill(code);
    await page.getByRole("button", { name: "Canjear código" }).click();
    await expect(page.getByText("Código canjeado.", { exact: false })).toBeVisible();
    await expect(page.getByText("Código utilizado.", { exact: false })).toBeVisible();

    const updatedResponse = await fetch(`${project.oss_host}/api/database/records/businesses?id=eq.${business.id}&select=promotion_starts_at,promotion_ends_at`, { headers });
    const updated = (await updatedResponse.json() as Array<{ promotion_starts_at: string; promotion_ends_at: string }>)[0];
    expect(updatedResponse.ok).toBeTruthy();
    expect(new Date(updated.promotion_starts_at).getTime()).toBe(new Date(business.trial_ends_at).getTime());
    expect(new Date(updated.promotion_ends_at).getTime()).toBe(new Date(business.trial_ends_at).getTime() + 30 * 86400000);
  } finally {
    if (code) {
      const hash = createHash("sha256").update(code.replaceAll("-", "")).digest("hex");
      const codeResponse = await fetch(`${project.oss_host}/api/database/records/promo_codes?code_hash=eq.${hash}&select=id`, { headers });
      const row = (await codeResponse.json() as Array<{ id: string }>)[0];
      if (row?.id) {
        const redemptionDelete = await fetch(`${project.oss_host}/api/database/records/promo_redemptions?code_id=eq.${row.id}`, { method: "DELETE", headers });
        if (!redemptionDelete.ok) throw new Error("No se pudo limpiar el canje E2E.");
        const businessRestore = await fetch(`${project.oss_host}/api/database/records/businesses?id=eq.${business.id}`, {
          method: "PATCH", headers,
          body: JSON.stringify({ promotion_starts_at: null, promotion_ends_at: null }),
        });
        if (!businessRestore.ok) throw new Error("No se pudo restaurar la cuenta demo.");
        const codeDelete = await fetch(`${project.oss_host}/api/database/records/promo_codes?id=eq.${row.id}`, { method: "DELETE", headers });
        if (!codeDelete.ok) throw new Error("No se pudo limpiar el código E2E.");
      }
    }
  }
});
