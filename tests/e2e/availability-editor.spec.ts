import { expect, test } from "@playwright/test";
import { adminRequest } from "./support/backend";
import { signIn } from "./support/dashboard";

test("editar disponibilidad conserva horarios más allá de la primera página", async ({ page }) => {
  test.setTimeout(180_000);
  const businessRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=id&limit=1")).json() as { id: string }[];
  const serviceRows = await (await adminRequest(`records/services?business_id=eq.${businessRows[0].id}&name=eq.${encodeURIComponent("Consulta inicial")}&select=id&limit=1`)).json() as { id: string }[];
  const serviceId = serviceRows[0].id;
  const firstDate = new Date();
  firstDate.setMonth(firstDate.getMonth() + 2, 1);
  firstDate.setHours(9, 0, 0, 0);
  const slots = Array.from({ length: 1001 }, (_, index) => {
    const startsAt = new Date(firstDate);
    startsAt.setDate(firstDate.getDate() + Math.floor(index / 16));
    startsAt.setHours(9 + Math.floor((index % 16) / 2), (index % 2) * 30, 0, 0);
    return {
      business_id: businessRows[0].id,
      service_id: serviceId,
      starts_at: startsAt.toISOString(),
      ends_at: new Date(startsAt.getTime() + 45 * 60_000).toISOString(),
      is_active: true,
    };
  });
  const lastDate = new Date(slots[slots.length - 1].starts_at);
  const monthValue = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, "0")}`;
  const addedStart = new Date(lastDate);
  addedStart.setHours(17, 30, 0, 0);

  try {
    for (let index = 0; index < slots.length; index += 200) {
      await adminRequest("records/service_availability_slots", { method: "POST", body: JSON.stringify(slots.slice(index, index + 200)) });
    }

    await signIn(page);
    await page.goto("/negocio/servicios");
    await page.getByRole("button", { name: "Editar Consulta inicial" }).click();
    const drawer = page.getByRole("dialog", { name: "Editar servicio" });
    await drawer.getByLabel("Mes").selectOption(monthValue);
    await drawer.getByRole("button", { name: new RegExp(`^${lastDate.getDate()}(?:\\D|$)`) }).first().click();
    await expect(drawer.getByText("09:00", { exact: true })).toBeVisible();
    await drawer.locator('input[type="time"]').fill("17:30");
    await drawer.getByRole("button", { name: "Agregar" }).click();
    await adminRequest("records/service_availability_slots", { method: "POST", body: JSON.stringify([{
      business_id: businessRows[0].id,
      service_id: serviceId,
      starts_at: addedStart.toISOString(),
      ends_at: new Date(addedStart.getTime() + 45 * 60_000).toISOString(),
      is_active: true,
    }]) });
    await drawer.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(drawer).toBeHidden();

    const addedRows = await (await adminRequest(`records/service_availability_slots?service_id=eq.${serviceId}&starts_at=eq.${encodeURIComponent(addedStart.toISOString())}&select=id`)).json() as { id: string }[];
    expect(addedRows).toHaveLength(1);
  } finally {
    const firstStart = slots[0].starts_at;
    const lastEnd = new Date(lastDate);
    lastEnd.setHours(18, 0, 0, 0);
    await adminRequest(`records/service_availability_slots?service_id=eq.${serviceId}&starts_at=gte.${encodeURIComponent(firstStart)}&starts_at=lt.${encodeURIComponent(lastEnd.toISOString())}`, { method: "DELETE" });
  }
});
