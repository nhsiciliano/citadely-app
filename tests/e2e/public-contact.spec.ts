import { expect, test } from "@playwright/test";
import { adminRequest, updateBusiness } from "./support/backend";

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
