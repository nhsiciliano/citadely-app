import { expect, type Page } from "@playwright/test";
import { env } from "./backend";

/** Signs the demo owner in through the login form and waits for the dashboard. */
export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(env("CITADELY_DEMO_EMAIL"));
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(env("CITADELY_DEMO_PASSWORD"));
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/negocio/);
  await expect(page.getByText("Consultorios Horizonte").first()).toBeVisible();
}
