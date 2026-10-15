import { expect, test } from "@playwright/test";
import { RUN_ID, adminRequest } from "./support/backend";
import { signIn } from "./support/dashboard";

test("cupos por horario: reservas públicas, email único, Agenda y liberación", async ({ page, request }) => {
  test.setTimeout(150_000);
  const runId = RUN_ID;
  const serviceName = `Curso grupal E2E ${runId}`;
  const date = new Date();
  date.setMonth(date.getMonth() + 2, 10);
  date.setHours(18, 0, 0, 0);
  const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const firstEmail = `grupo-a-${runId}@example.com`;
  const secondEmail = `grupo-b-${runId}@example.com`;

  await signIn(page);
  await page.goto("/negocio/servicios?nuevo=1");
  const drawer = page.getByRole("dialog", { name: "Nuevo servicio" });
  await drawer.getByLabel("Nombre").fill(serviceName);
  await drawer.getByLabel("Duración en minutos").fill("60");
  await drawer.getByLabel("Cobro al reservar").selectOption("free");
  await drawer.getByLabel("Mes").selectOption(monthValue);
  await drawer.getByRole("button", { name: /^10(?:\D|$)/ }).first().click();
  await drawer.locator('input[type="time"]').fill("18:00");
  await drawer.getByRole("button", { name: "Agregar" }).click();
  await drawer.getByLabel("Cupo").fill("3");
  await drawer.getByRole("button", { name: "Guardar servicio" }).click();
  await expect(drawer).toBeHidden();

  await page.goto("/b/citadely-demo-ux");
  await page.getByRole("button", { name: new RegExp(serviceName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  const timeButton = page.getByRole("button", { name: /^18:00/ });
  await expect(timeButton).toHaveAttribute("aria-label", "18:00, 3 de 3 cupos disponibles");
  await timeButton.hover();
  await expect(timeButton.getByText("3 de 3 cupos disponibles")).toBeVisible();

  async function reserve(name: string, email: string) {
    await timeButton.click();
    await page.getByLabel("Nombre y apellido").fill(name);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Teléfono").fill("1199887766");
    await page.getByRole("button", { name: "Confirmar reserva" }).click();
  }

  await reserve("Participante Uno", firstEmail);
  await expect(page.getByText(/reserva confirmada/i)).toBeVisible();
  await expect(timeButton).toHaveAttribute("aria-label", "18:00, 2 de 3 cupos disponibles");
  await reserve("Participante Duplicado", firstEmail.toUpperCase());
  await expect(page.getByText(/este email ya tiene una reserva/i)).toBeVisible();
  await expect(timeButton).toHaveAttribute("aria-label", "18:00, 2 de 3 cupos disponibles");
  await reserve("Participante Dos", secondEmail);
  await expect(page.getByText(/reserva confirmada/i)).toBeVisible();
  await expect(timeButton).toHaveAttribute("aria-label", "18:00, 1 de 3 cupos disponibles");

  await page.goto("/negocio/agenda");
  await page.getByRole("button", { name: "Nuevo turno" }).click();
  const appointmentDrawer = page.getByRole("dialog", { name: "Nuevo turno" });
  await appointmentDrawer.getByRole("button", { name: new RegExp(serviceName) }).click();
  await appointmentDrawer.getByRole("button", { name: /^18:00/ }).click();
  await appointmentDrawer.getByRole("button", { name: "Seleccionar cliente" }).click();
  await page.getByRole("dialog", { name: "Seleccionar cliente" }).getByRole("button", { name: "Crear nuevo cliente" }).click();
  const clientDrawer = page.getByRole("dialog", { name: "Nuevo cliente" });
  await clientDrawer.getByLabel("Nombre").fill(`Participante Manual ${runId}`);
  await clientDrawer.getByLabel("Email").fill(`grupo-manual-${runId}@example.com`);
  await clientDrawer.getByRole("button", { name: "Guardar cliente" }).click();
  await appointmentDrawer.getByRole("button", { name: "Guardar turno" }).click();
  await expect(appointmentDrawer).toBeHidden();

  await page.goto("/b/citadely-demo-ux");
  await page.getByRole("button", { name: new RegExp(serviceName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^18:00/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^18:00/ })).toContainText("Completo");

  const services = await (await adminRequest(`records/services?name=eq.${encodeURIComponent(serviceName)}&select=id`)).json() as { id: string }[];
  const appointments = await (await adminRequest(`records/appointments?service_id=eq.${services[0].id}&select=id,source`)).json() as { id: string; source: string }[];
  expect(appointments).toHaveLength(3);
  await adminRequest(`records/appointments?id=eq.${appointments.find((appointment) => appointment.source === "public_booking")?.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  });
  await page.reload();
  await page.getByRole("button", { name: new RegExp(serviceName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^18:00/ })).toHaveAttribute("aria-label", "18:00, 1 de 3 cupos disponibles");

  const slotRows = await (await adminRequest(`records/service_availability_slots?service_id=eq.${services[0].id}&select=id`)).json() as { id: string }[];
  const businessRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=id&limit=1")).json() as { id: string }[];
  const payload = (suffix: string) => ({
    businessId: businessRows[0].id,
    serviceId: services[0].id,
    startsAt: date.toISOString(),
    clientName: `Simultáneo ${suffix}`,
    clientEmail: `simultaneo-${suffix}-${runId}@example.com`,
    clientPhone: "1199887766",
  });
  const results = await Promise.all(["a", "b"].map((suffix) => request.post("/api/public-booking", {
    data: payload(suffix),
  })));
  expect(results.filter((response) => response.ok())).toHaveLength(1);
  expect(results.filter((response) => response.status() === 409)).toHaveLength(1);
  await expect(adminRequest(`records/service_availability_slots?id=eq.${slotRows[0].id}`, {
    method: "PATCH", body: JSON.stringify({ capacity: 2 }),
  })).rejects.toThrow();
  await expect(adminRequest(`records/service_availability_slots?id=eq.${slotRows[0].id}`, {
    method: "DELETE",
  })).rejects.toThrow();
  await page.reload();
  await page.getByRole("button", { name: new RegExp(serviceName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^18:00/ })).toBeDisabled();
});

test("una seña vencida libera plaza y otro servicio superpuesto queda bloqueado", async ({ page, request }) => {
  const runId = RUN_ID;
  const businessRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=id&limit=1")).json() as { id: string }[];
  const businessId = businessRows[0].id;
  const date = new Date();
  date.setMonth(date.getMonth() + 3, 22);
  date.setHours(20, 0, 0, 0);
  const endsAt = new Date(date.getTime() + 60 * 60_000);
  const primaryName = `Taller con seña E2E ${runId}`;
  const otherName = `Servicio paralelo E2E ${runId}`;
  await adminRequest("records/services", { method: "POST", body: JSON.stringify([
    { business_id: businessId, name: primaryName, duration_minutes: 60, price_cents: 5000, requires_payment: true, deposit_type: "deposit", deposit_value_cents: 1000 },
    { business_id: businessId, name: otherName, duration_minutes: 60, price_cents: 0, requires_payment: false, deposit_type: "free", deposit_value_cents: 0 },
  ]) });
  const primaryRows = await (await adminRequest(`records/services?business_id=eq.${businessId}&name=eq.${encodeURIComponent(primaryName)}&select=id`)).json() as { id: string }[];
  const otherRows = await (await adminRequest(`records/services?business_id=eq.${businessId}&name=eq.${encodeURIComponent(otherName)}&select=id`)).json() as { id: string }[];
  const primaryId = primaryRows[0].id;
  const otherId = otherRows[0].id;
  await adminRequest("records/service_availability_slots", { method: "POST", body: JSON.stringify([
    { business_id: businessId, service_id: primaryId, starts_at: date.toISOString(), ends_at: endsAt.toISOString(), capacity: 2 },
    { business_id: businessId, service_id: otherId, starts_at: date.toISOString(), ends_at: endsAt.toISOString(), capacity: 1 },
  ]) });
  const booking = (serviceId: string, suffix: string) => request.post("/api/public-booking", { data: {
    businessId, serviceId, startsAt: date.toISOString(), clientName: `Cliente ${suffix}`,
    clientEmail: `senia-${suffix}-${runId}@example.com`, clientPhone: "1199887766",
  } });
  const first = await booking(primaryId, "uno");
  expect(first.ok()).toBe(true);
  expect((await first.json() as { status: string }).status).toBe("pending_payment");
  expect((await booking(otherId, "paralelo")).status()).toBe(409);

  const appointments = await (await adminRequest(`records/appointments?service_id=eq.${primaryId}&select=id`)).json() as { id: string }[];
  await adminRequest(`records/appointments?id=eq.${appointments[0].id}`, {
    method: "PATCH", body: JSON.stringify({ deposit_expires_at: new Date(Date.now() - 60_000).toISOString() }),
  });
  await page.goto("/b/citadely-demo-ux");
  await page.getByRole("button", { name: new RegExp(primaryName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^20:00/ })).toContainText("2 de 2 cupos disponibles");
  expect((await booking(otherId, "paralelo-despues")).ok()).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: new RegExp(primaryName) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^20:00/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^20:00/ })).toContainText("No disponible");
});
