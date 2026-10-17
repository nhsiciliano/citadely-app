import { expect, type Page } from "@playwright/test";
import { env } from "./backend";

/** Signs the demo owner in through the login form and waits for the dashboard. */
export async function signIn(page: Page) {
  await page.goto("/login");
  // The form must be hydrated before submitting: on a cold dev server an early click is a native GET submit.
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(env("CITADELY_DEMO_EMAIL"));
  await page.getByRole("textbox", { name: "Contraseña", exact: true }).fill(env("CITADELY_DEMO_PASSWORD"));
  await page.getByRole("button", { name: "Ingresar" }).click();
  // A cold dev server compiles /negocio for every worker at once: give the first login room.
  await expect(page).toHaveURL(/\/negocio/, { timeout: 30_000 });
  await expect(page.getByText("Consultorios Horizonte").first()).toBeVisible();
}
