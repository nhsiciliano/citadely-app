import { expect, test } from "@playwright/test";
import { RUN_ID, adminRequest } from "./support/backend";
import { signIn } from "./support/dashboard";

test("landing, navegación operativa, CRUD y reserva pública", async ({ page }) => {
  const runId = RUN_ID;
  let serviceName = `Seguimiento E2E ${runId}`;
  const clientName = `Cliente E2E ${runId}`;
  const publicClientName = `Reserva Pública ${runId}`;
  const availabilityDate = new Date();
  availabilityDate.setDate(availabilityDate.getDate() + 7);
  availabilityDate.setHours(10, 0, 0, 0);
  const monthValue = `${availabilityDate.getFullYear()}-${String(availabilityDate.getMonth() + 1).padStart(2, "0")}`;

  // La landing (/) la sirve Astro vía rewrite (el detalle de SEO está en public-seo.spec.ts): acá solo un chequeo liviano.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Citadely es gratis" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Crear mi cuenta" }).first()).toHaveAttribute("href", "/registro");

  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeVisible();
  await signIn(page);

  for (const [label, path, heading] of [
    ["Agenda", "/negocio/agenda", "Agenda"],
    ["Servicios", "/negocio/servicios", "Servicios"],
    ["Clientes", "/negocio/clientes", "Clientes"],
    ["Página pública", "/negocio/pagina-publica", "Página pública"],
    ["Configuración", "/negocio/configuracion", "Configuración"],
  ] as const) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  await page.getByLabel("Alias").fill(`demo.${runId}`);
  await page.getByLabel("CBU o CVU").fill("0000003100012345678901");
  await page.getByLabel("Instrucciones de pago").fill("Enviar comprobante por WhatsApp.");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText("Configuración guardada.")).toBeVisible();

  await page.goto("/negocio/pagina-publica");
  await expect(page.locator("h2").filter({ hasText: /^Galería$/ })).toBeVisible();
  await page.getByLabel("WhatsApp de contacto").fill("5491123456789");
  await page.getByLabel("Dirección pública").fill("Av. Corrientes 1234, Ciudad Autónoma de Buenos Aires");
  if (await page.getByRole("button", { name: /Eliminar foto/ }).count() === 0) {
    await page.locator('input[name="gallery_files"]').setInputFiles({
      name: `galeria-${runId}.png`,
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
  }
  if (await page.getByRole("group", { name: /Pregunta frecuente/ }).count() === 0) {
    await page.getByRole("button", { name: "Agregar pregunta" }).click();
  }
  const faqEditor = page.getByRole("group", { name: /Pregunta frecuente/ }).first();
  await faqEditor.getByLabel("Pregunta", { exact: true }).fill("¿Cómo solicito mi turno?");
  await page.locator('textarea[placeholder="Elegí un servicio, fecha y horario disponible."]').first().fill("Elegí un servicio y uno de los horarios disponibles.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Página pública actualizada.")).toBeVisible();

  await page.goto("/negocio/servicios?nuevo=1");
  const serviceDialog = page.getByRole("dialog", { name: "Nuevo servicio" });
  await expect(serviceDialog).toBeVisible();
  await serviceDialog.getByLabel("Nombre").fill(serviceName);
  await serviceDialog.getByLabel("Descripción").fill("Servicio sintético creado por la cobertura E2E.");
  await serviceDialog.getByLabel("Duración en minutos").fill("30");
  await serviceDialog.getByLabel("Precio").fill("22000");
  await serviceDialog.getByLabel("Cobro al reservar").selectOption("free");
  await serviceDialog.getByLabel("Mes").selectOption(monthValue);
  await serviceDialog.getByRole("button", { name: new RegExp(`^${availabilityDate.getDate()}`) }).first().click();
  await serviceDialog.locator('input[type="time"]').fill("10:00");
  await serviceDialog.getByRole("button", { name: "Agregar" }).click();
  await expect(serviceDialog.getByText("10:00")).toBeVisible();
  await serviceDialog.locator('input[type="time"]').fill("11:00");
  await serviceDialog.getByRole("button", { name: "Agregar" }).click();
  await expect(serviceDialog.getByText("11:00")).toBeVisible();
  await serviceDialog.locator('input[type="time"]').fill("12:00");
  await serviceDialog.getByRole("button", { name: "Agregar" }).click();
  await expect(serviceDialog.getByText("12:00")).toBeVisible();
  await serviceDialog.getByRole("button", { name: "Guardar servicio" }).click();
  await expect(serviceDialog).toBeHidden();
  await expect(page.getByText(serviceName)).toBeVisible();

  await page.getByRole("button", { name: `Editar ${serviceName}` }).click();
  const editServiceDialog = page.getByRole("dialog", { name: "Editar servicio" });
  await expect(editServiceDialog.getByLabel("Nombre")).toHaveValue(serviceName);
  await expect(editServiceDialog.getByLabel("Duración en minutos")).toHaveValue("30");
  const editedServiceName = `Seguimiento editado E2E ${runId}`;
  await editServiceDialog.getByLabel("Nombre").fill(editedServiceName);
  await editServiceDialog.getByLabel("Duración en minutos").fill("45");
  await editServiceDialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(editServiceDialog).toBeHidden();
  serviceName = editedServiceName;
  await expect(page.getByText(serviceName)).toBeVisible();

  await page.goto("/negocio/clientes?nuevo=1");
  const clientDialog = page.getByRole("dialog", { name: "Nuevo cliente" });
  await expect(clientDialog).toBeVisible();
  await clientDialog.getByLabel("Nombre").fill(clientName);
  await clientDialog.getByLabel("Email").fill(`cliente-${runId}@example.com`);
  await clientDialog.getByLabel("Teléfono").fill("1122334455");
  await clientDialog.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(clientDialog).toBeHidden();
  await expect(page.getByText(clientName)).toBeVisible();

  await page.goto("/negocio/agenda");
  await expect(page.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Día" }).click();
  await expect(page.getByRole("button", { name: "Día" })).toHaveAttribute("aria-pressed", "true");
  for (let day = 0; day < 7; day += 1) await page.getByRole("button", { name: "Período siguiente" }).click();
  await page.getByLabel("Filtrar por servicio").selectOption({ label: serviceName });
  await page.getByLabel("Filtrar por estado").selectOption("available");
  await expect(page.getByText("Turno libre").first()).toBeVisible();
  await page.getByLabel("Filtrar por estado").selectOption("all");
  await page.getByRole("button", { name: "Nuevo turno" }).click();
  const appointmentDialog = page.getByRole("dialog", { name: "Nuevo turno" });
  await appointmentDialog.getByRole("button", { name: new RegExp(serviceName) }).click();
  await appointmentDialog.getByRole("button", { name: /^11:00/ }).click();
  await appointmentDialog.getByRole("button", { name: "Seleccionar cliente" }).click();
  const clientPicker = page.getByRole("dialog", { name: "Seleccionar cliente" });
  const clientSearch = clientPicker.getByRole("searchbox", { name: "Buscar clientes" });
  for (const query of [clientName, `cliente-${runId}@example.com`, "1122334455"]) {
    await clientSearch.fill(query);
    await expect(clientPicker.getByRole("button", { name: clientName })).toBeVisible();
  }
  await clientSearch.fill("sin-coincidencias-e2e");
  await expect(clientPicker.getByText("No encontramos coincidencias")).toBeVisible();
  await clientSearch.fill(clientName);
  await clientPicker.getByRole("button", { name: clientName }).click();
  await expect(clientPicker).toBeHidden();
  await expect(appointmentDialog.getByRole("button", { name: clientName })).toBeVisible();
  await expect(appointmentDialog.getByRole("button", { name: /^11:00/ })).toHaveAttribute("aria-pressed", "true");
  await appointmentDialog.getByRole("button", { name: clientName }).click();
  await clientPicker.getByRole("button", { name: "Crear nuevo cliente" }).click();
  const quickClientDialog = page.getByRole("dialog", { name: "Nuevo cliente" });
  const quickClientName = `Cliente rápido E2E ${runId}`;
  await quickClientDialog.getByLabel("Nombre").fill(quickClientName);
  await quickClientDialog.getByLabel("Email").fill(`rapido-${runId}@example.com`);
  await quickClientDialog.getByLabel("Teléfono").fill("1199776655");
  await quickClientDialog.getByRole("button", { name: "Guardar cliente" }).click();
  await expect(quickClientDialog).toBeHidden();
  await expect(appointmentDialog.getByRole("button", { name: quickClientName })).toBeVisible();
  await expect(appointmentDialog.getByRole("button", { name: /^11:00/ })).toHaveAttribute("aria-pressed", "true");
  await appointmentDialog.getByRole("button", { name: "Guardar turno" }).click();
  await expect(appointmentDialog).toBeHidden();

  await page.getByLabel("Filtrar por estado").selectOption("available");
  await page.getByRole("button", { name: /Turno libre a las 12:00/ }).click();
  const agendaAssignment = page.getByRole("dialog", { name: "Nuevo turno" });
  await expect(agendaAssignment).toContainText("Asigná este horario libre a un cliente.");
  await expect(agendaAssignment.getByText(/12:00/)).toBeVisible();
  await expect(agendaAssignment.getByRole("button", { name: new RegExp(serviceName) })).toHaveAttribute("aria-pressed", "true");
  await agendaAssignment.getByRole("button", { name: "Seleccionar cliente" }).click();
  await page.getByRole("dialog", { name: "Seleccionar cliente" }).getByRole("button", { name: clientName }).click();
  await agendaAssignment.getByRole("button", { name: "Guardar turno" }).click();
  await expect(agendaAssignment).toBeHidden();
  await expect(page.getByRole("button", { name: /Turno libre a las 12:00/ })).toHaveCount(0);
  await expect(page.getByLabel("Filtrar por estado")).toHaveValue("available");
  await expect(page.getByLabel("Filtrar por servicio").locator("option:checked")).toHaveText(serviceName);

  const businessRows = await (await adminRequest("records/businesses?slug=eq.citadely-demo-ux&select=id&limit=1")).json() as { id: string }[];
  const serviceRows = await (await adminRequest(`records/services?business_id=eq.${businessRows[0].id}&name=eq.${encodeURIComponent(serviceName)}&select=id&limit=1`)).json() as { id: string }[];
  const denseSlots = [0, 15, 30].map((minute) => {
    const startsAt = new Date(availabilityDate);
    startsAt.setHours(13, minute, 0, 0);
    return { business_id: businessRows[0].id, service_id: serviceRows[0].id, starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 45 * 60_000).toISOString(), is_active: true };
  });
  await adminRequest("records/service_availability_slots", { method: "POST", body: JSON.stringify(denseSlots) });
  await page.reload();
  await page.getByRole("button", { name: "Día" }).click();
  for (let day = 0; day < 7; day += 1) await page.getByRole("button", { name: "Período siguiente" }).click();
  await page.getByLabel("Filtrar por servicio").selectOption({ label: serviceName });
  await page.getByLabel("Filtrar por estado").selectOption("available");
  await page.getByRole("button", { name: /3 horarios libres entre 13:00 y 14:00/ }).click();
  await page.getByRole("button", { name: /Asignar turno libre a las 13:15/ }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo turno" }).getByText(/13:15/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Nuevo turno" })).toBeHidden();
  await expect(page.getByLabel("Filtrar por estado")).toHaveValue("available");

  await page.getByLabel("Filtrar por servicio").selectOption("all");
  await page.getByRole("button", { name: /Turno libre a las 17:00/ }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo turno" }).getByText(/17:00/)).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Nuevo turno" }).getByRole("group", { name: "Servicios disponibles" }).getByRole("button")).toHaveCount(4);
  await page.getByRole("dialog", { name: "Nuevo turno" }).getByRole("button", { name: "Cerrar panel" }).click();

  await page.goto("/negocio#servicios");
  await expect(page).toHaveURL(/\/negocio\/servicios/);

  await page.goto("/b/citadely-demo-ux");
  await expect(page.getByRole("heading", { name: "Consultorios Horizonte", exact: true })).toBeVisible();
  const publicHeader = page.locator("header").first();
  await expect(publicHeader).not.toContainText(/fechas disponibles|lun|mar|mié|jue|vie/i);
  await expect(publicHeader.getByRole("link", { name: "Reservar turno" })).toBeVisible();
  await expect(publicHeader.getByRole("link", { name: "Contactar a Consultorios Horizonte por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5491123456789/);
  const informationHeading = page.getByRole("heading", { name: "Información del servicio", exact: true });
  await expect(informationHeading).toBeVisible();
  await expect(page.getByText("+5491123456789", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Información del servicio").getByText("Av. Corrientes 1234, Ciudad Autónoma de Buenos Aires", { exact: true })).toBeVisible();
  await expect(page.getByTitle("Mapa de Consultorios Horizonte")).toHaveAttribute("src", /maps\.google\.com\/maps\?q=Av\.%20Corrientes%201234/);
  await expect(page.getByRole("heading", { name: "Galería", exact: true })).toBeVisible();
  const publicHeadings = await page.locator("h2").allTextContents();
  expect(publicHeadings.indexOf("Galería")).toBeLessThan(publicHeadings.indexOf("Información del servicio"));
  await expect(page.getByRole("heading", { name: "Preguntas frecuentes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "¿Cómo solicito mi turno?" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Elegí un servicio y uno de los horarios disponibles.")).toBeVisible();
  const publicService = page.getByRole("button", { name: new RegExp(serviceName) });
  await publicService.click();
  await page.getByRole("dialog").getByRole("button", { name: "Elegir este servicio" }).click();
  await expect(page.getByRole("button", { name: /^13:15/ })).toBeVisible();
  await page.getByRole("button", { name: /10:00/ }).last().click();
  await page.getByLabel("Nombre y apellido").fill(publicClientName);
  await page.getByLabel("Email").fill(`publico-${runId}@example.com`);
  await page.getByLabel("Teléfono").fill("1199887766");
  await page.getByLabel("Nota para el negocio").fill("Reserva generada por Playwright");
  await page.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(page.getByText(/reserva confirmada/i)).toBeVisible();

  await page.goto("/negocio/clientes");
  await page.getByRole("searchbox", { name: "Buscar clientes" }).fill(publicClientName);
  await expect(page.getByText(publicClientName)).toBeVisible();
});
