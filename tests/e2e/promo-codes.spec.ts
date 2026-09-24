import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

test("panel de códigos: crear, editar, desactivar y proteger acceso", async ({ page, request }) => {
  const password = process.env.E2E_ADMIN_PASSWORD;
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!password || !baseUrl || !apiKey) throw new Error("Faltan credenciales E2E de Preview.");

  expect((await request.get("/admin-panel/api/promo-codes")).status()).toBe(401);
  expect((await request.post("/admin-panel/api/promo-codes", {
    headers: { Origin: "http://127.0.0.1:3002" }, data: { durationDays: 30, maxUses: 2 },
  })).status()).toBe(401);

  let createdCode = "";
  try {
    await page.goto("/admin-panel");
    await page.getByLabel("Usuario").fill("admin");
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await page.getByRole("link", { name: "Códigos" }).click();
    await expect(page).toHaveURL(/\/admin-panel\/codigos$/);
    await expect(page.getByRole("heading", { name: "Códigos Pro" })).toBeVisible();

    await page.getByLabel("Días gratis").fill("30");
    await page.getByLabel("Cantidad de usos").fill("2");
    await page.getByRole("button", { name: "Crear código" }).click();
    const newCodeInput = page.getByLabel("Código creado");
    await expect(newCodeInput).toBeVisible();
    createdCode = await newCodeInput.inputValue();
    expect(createdCode).toMatch(/^CTD-(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/);
    await expect(page.getByText("30 días · 0 de 2 usos · 2 disponibles")).toBeVisible();

    const row = page.locator("article", { hasText: createdCode.slice(-4) });
    await row.getByRole("button", { name: "Editar" }).click();
    await row.getByLabel("Días").fill("45");
    await row.getByLabel("Cupo").fill("3");
    await row.getByRole("button", { name: "Guardar" }).click();
    await expect(row).toContainText("45 días · 0 de 3 usos · 3 disponibles");

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Desactivar" }).click();
    await expect(row).toContainText("Desactivado");
    await page.reload();
    await expect(page.locator("article", { hasText: createdCode.slice(-4) })).toContainText("Desactivado");
  } finally {
    if (createdCode) {
      const normalized = createdCode.replaceAll("-", "");
      const hash = createHash("sha256").update(normalized).digest("hex");
      const response = await fetch(`${baseUrl}/api/database/records/promo_codes?code_hash=eq.${hash}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey },
      });
      if (!response.ok) throw new Error(`No se pudo limpiar el código E2E (${response.status}).`);
    }
  }
});
