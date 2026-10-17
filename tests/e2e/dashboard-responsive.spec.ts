import { expect, test } from "@playwright/test";
import { signIn } from "./support/dashboard";

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
