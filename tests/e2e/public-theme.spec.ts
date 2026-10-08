import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { contrastRatio, normalizePublicTheme, resolveSectionColors, sectionThemeStyle } from "../../lib/public-theme";

const env = readFileSync(".env.local", "utf8");
const value = (name: string) => env.split(/\r?\n/).find((line) => line.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";

test("colores personalizados mantienen contraste y se validan", () => {
  expect(normalizePublicTheme({ faq: { background: "red", accent: "#FFFFFF" }, unknown: { accent: "#000000" } })).toEqual({ faq: { accent: "#ffffff" } });
  expect(sectionThemeStyle("faq", {}, "#0957d9")).toBeUndefined();
  for (const background of ["#ffffff", "#111827", "#ffff00", "#777777", "#0957d9"]) {
    for (const accent of ["#ffffff", "#111827", "#ffff00", "#777777", "#0957d9"]) {
      const colors = resolveSectionColors("faq", { faq: { background, accent } }, "#0957d9");
      expect(contrastRatio(colors.ink, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.muted, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.accent, colors.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.accentInk, colors.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.cardAccent, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.cardAccentInk, colors.cardAccent)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("editor de colores actualiza la vista previa y permite restaurar", async ({ page }) => {
  test.skip(!value("CITADELY_DEMO_EMAIL") || !value("CITADELY_DEMO_PASSWORD"), "Requiere cuenta demo local.");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(value("CITADELY_DEMO_EMAIL"));
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(value("CITADELY_DEMO_PASSWORD"));
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/negocio/);
  await page.goto("/negocio/pagina-publica");

  const editor = page.getByRole("heading", { name: "Colores de la página" }).locator("xpath=ancestor::section[1]");
  const preview = page.getByRole("region", { name: "Vista previa de la página pública" });
  const faq = editor.locator("details").filter({ has: page.locator("summary", { hasText: "Preguntas frecuentes" }) });
  await faq.locator("summary").click();
  await editor.getByRole("textbox", { name: "Fondo de Preguntas frecuentes", exact: true }).fill("#111827");
  await editor.getByRole("textbox", { name: "Acento de Preguntas frecuentes", exact: true }).fill("#111827");

  await expect(preview.locator(".public-theme-faq")).toHaveCSS("background-color", "rgb(17, 24, 39)");
  await expect(preview.locator(".public-theme-faq .public-faq-question").first()).not.toHaveCSS("background-color", "rgb(17, 24, 39)");
  await expect(faq).toContainText("Acento aplicado:");
  await expect(preview.locator(".public-theme-faq .public-faq-answer p").first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(preview.locator(".public-theme-faq")).toBeVisible();
  expect(await preview.locator(".public-theme-faq").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  await faq.getByRole("button", { name: "Restaurar sección" }).click();
  await expect(preview.locator(".public-theme-faq")).toHaveCount(0);
  await expect(faq).toContainText("Predeterminado");

  await editor.getByRole("textbox", { name: "Fondo de Preguntas frecuentes", exact: true }).fill("#111827");
  await editor.getByRole("button", { name: "Restaurar todos" }).click();
  await expect(preview.locator(".public-theme-faq")).toHaveCount(0);
});
