#!/usr/bin/env node

import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@insforge/sdk";
import { confirmSeedTarget } from "./lib/seed-guard.mjs";

const EMAIL = "demo.ux@citadely.test";
const BUSINESS_SLUG = "citadely-demo-ux";
const ENV_PATH = ".env.local";

await confirmSeedTarget("seed:demo");

function readProjectConfig() {
  return JSON.parse(fs.readFileSync(".insforge/project.json", "utf8"));
}

function readLocalEnv() {
  const source = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

// The environment wins over .env.local, so CI and E2E runs can provide the demo account without any file.
// Missing values are generated once and appended to .env.local (local use).
function ensureLocalCredentials() {
  const env = {
    ...readLocalEnv(),
    ...(process.env.CITADELY_DEMO_EMAIL ? { CITADELY_DEMO_EMAIL: process.env.CITADELY_DEMO_EMAIL } : {}),
    ...(process.env.CITADELY_DEMO_PASSWORD ? { CITADELY_DEMO_PASSWORD: process.env.CITADELY_DEMO_PASSWORD } : {}),
  };
  const password = env.CITADELY_DEMO_PASSWORD || `Citadely-${randomBytes(12).toString("base64url")}9!`;
  const additions = [];

  if (!env.CITADELY_DEMO_EMAIL) additions.push(`CITADELY_DEMO_EMAIL=${EMAIL}`);
  if (!env.CITADELY_DEMO_PASSWORD) additions.push(`CITADELY_DEMO_PASSWORD=${password}`);
  if (additions.length > 0) fs.appendFileSync(ENV_PATH, `\n# Cuenta demo UX (solo local)\n${additions.join("\n")}\n`);

  return { email: env.CITADELY_DEMO_EMAIL || EMAIL, password };
}

function addDays(days, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

async function ensureUser(baseUrl, apiKey, credentials) {
  const client = createClient({ baseUrl, anonKey: apiKey });
  let login = await client.auth.signInWithPassword(credentials);

  if (login.error || !login.data?.user) {
    const response = await fetch(`${baseUrl}/api/auth/users?client_type=server`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ ...credentials, name: "Equipo Citadely Demo", autoConfirm: true }),
    });

    if (!response.ok && response.status !== 409) {
      const detail = await response.text();
      throw new Error(`No se pudo crear la cuenta demo (${response.status}): ${detail.slice(0, 240)}`);
    }

    login = await client.auth.signInWithPassword(credentials);
  }

  if (login.error || !login.data?.user) throw new Error(`No se pudo iniciar la sesión demo: ${login.error?.message ?? "sin usuario"}`);
  return { client, user: login.data.user };
}

async function ensureBusiness(client, userId) {
  const payload = {
    owner_id: userId,
    name: "Consultorios Horizonte",
    slug: BUSINESS_SLUG,
    category: "consultorio_clinico",
    description: "Atención profesional con turnos programados para consultas, controles y evaluaciones.",
    brand_color: "#174ea6",
    payment_alias: "horizonte.turnos",
    payment_cbu: "0000003100012345678901",
    payment_instructions: "Enviá el comprobante por WhatsApp para confirmar la seña.",
    whatsapp_phone: "5491123456789",
    public_address: "Av. Corrientes 1234, Ciudad Autónoma de Buenos Aires",
    is_public: true,
    trial_ends_at: addDays(90, 23, 59).toISOString(),
    subscription_status: "trialing",
    // Estado de suscripción y promo reseteados en cada corrida: si un test dejó el negocio vencido, vuelve a estar activo.
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
    pending_subscription_plan: null,
    promotion_starts_at: null,
    promotion_ends_at: null,
    is_demo: true,
  };
  const existing = await client.database.from("businesses").select("*").eq("owner_id", userId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    const result = await client.database.from("businesses").update(payload).eq("id", existing.data.id).select("*").single();
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }
  const result = await client.database.from("businesses").insert([payload]).select("*").single();
  if (result.error || !result.data) throw new Error(result.error?.message ?? "No se pudo crear el negocio demo.");
  return result.data;
}

async function resetDemoData(client, businessId) {
  for (const table of ["appointments", "service_availability_slots", "services", "clients"]) {
    const result = await client.database.from(table).delete().eq("business_id", businessId);
    if (result.error) throw new Error(`No se pudo limpiar ${table}: ${result.error.message}`);
  }
}

async function seedDemoData(client, admin, business) {
  const serviceResult = await client.database.from("services").insert([
    { business_id: business.id, name: "Consulta inicial", description: "Primera evaluación y definición del plan de atención.", duration_minutes: 45, price_cents: 2800000, requires_payment: true, deposit_type: "deposit", deposit_value_cents: 800000, is_active: true },
    { business_id: business.id, name: "Control clínico", description: "Seguimiento programado de 30 minutos.", duration_minutes: 30, price_cents: 1800000, requires_payment: false, deposit_type: "free", deposit_value_cents: 0, is_active: true },
    { business_id: business.id, name: "Evaluación extendida", description: "Evaluación integral con tiempo adicional.", duration_minutes: 60, price_cents: 3600000, requires_payment: true, deposit_type: "deposit", deposit_value_cents: 1000000, is_active: true },
    { business_id: business.id, name: "Videoconsulta", description: "Consulta remota de seguimiento.", duration_minutes: 30, price_cents: 2000000, requires_payment: true, deposit_type: "full", deposit_value_cents: 2000000, is_active: true },
  ]).select("*");
  if (serviceResult.error || !serviceResult.data) throw new Error(serviceResult.error?.message ?? "No se pudieron crear servicios demo.");

  const clientResult = await client.database.from("clients").insert([
    ["Luciana Martínez", "luciana@example.com", "1151002001"],
    ["Camila Fernández", "camila@example.com", "1151002002"],
    ["Julieta Rojas", "julieta@example.com", "1151002003"],
    ["Facundo Pérez", "facundo@example.com", "1151002004"],
    ["Martín Acosta", "martin@example.com", "1151002005"],
    ["Sofía Benítez", "sofia@example.com", "1151002006"],
  ].map(([name, email, phone]) => ({ business_id: business.id, name, email, phone })) ).select("*");
  if (clientResult.error || !clientResult.data) throw new Error(clientResult.error?.message ?? "No se pudieron crear clientes demo.");

  const services = serviceResult.data;
  const clients = clientResult.data;
  const slots = [];
  for (let day = 0; day < 21; day += 1) {
    const weekday = addDays(day, 9).getDay();
    if (weekday === 0 || weekday === 6) continue;
    for (const service of services) {
      for (const [hour, minute] of [[9, 0], [10, 30], [12, 0], [14, 0], [15, 30], [17, 0]]) {
        const startsAt = addDays(day, hour, minute);
        slots.push({ business_id: business.id, service_id: service.id, starts_at: startsAt.toISOString(), ends_at: addMinutes(startsAt, service.duration_minutes).toISOString(), is_active: true });
      }
    }
  }
  const appointmentBlueprints = [
    [0, 9, 0, 0, 0, "confirmed", 0],
    [0, 10, 30, 1, 1, "confirmed", 0],
    [0, 12, 0, 2, 2, "pending_payment", 1000000],
    [0, 14, 0, 3, 3, "confirmed", 2000000],
    [0, 15, 30, 4, 0, "confirmed", 800000],
    [1, 9, 0, 5, 1, "confirmed", 0],
    [1, 12, 0, 0, 2, "pending_payment", 1000000],
    [2, 10, 30, 1, 0, "confirmed", 800000],
    [-1, 11, 0, 2, 1, "completed", 0],
    [-2, 14, 0, 3, 3, "no_show", 2000000],
  ];
  const appointments = appointmentBlueprints.map(([day, hour, minute, clientIndex, serviceIndex, status, deposit]) => {
    const service = services[serviceIndex];
    const startsAt = addDays(day, hour, minute);
    return {
      business_id: business.id,
      client_id: clients[clientIndex].id,
      service_id: service.id,
      starts_at: startsAt.toISOString(),
      ends_at: addMinutes(startsAt, service.duration_minutes).toISOString(),
      status,
      source: "business",
      deposit_amount_cents: deposit,
      deposit_expires_at: status === "pending_payment" ? addMinutes(new Date(), 90).toISOString() : null,
    };
  });
  // The seat guard rejects future appointments without a published slot: publish any the grid above misses.
  const slotKeys = new Set(slots.map((slot) => `${slot.service_id}|${slot.starts_at}`));
  for (const appointment of appointments) {
    if (appointment.status === "cancelled" || new Date(appointment.starts_at) <= new Date()) continue;
    if (slotKeys.has(`${appointment.service_id}|${appointment.starts_at}`)) continue;
    slots.push({ business_id: business.id, service_id: appointment.service_id, starts_at: appointment.starts_at, ends_at: appointment.ends_at, is_active: true });
  }
  const slotsResult = await client.database.from("service_availability_slots").insert(slots);
  if (slotsResult.error) throw new Error(slotsResult.error.message);

  const appointmentResult = await admin.database.from("appointments").insert(appointments);
  if (appointmentResult.error) throw new Error(appointmentResult.error.message);

  return { services: services.length, clients: clients.length, appointments: appointments.length, slots: slots.length };
}

async function main() {
  const project = readProjectConfig();
  const credentials = ensureLocalCredentials();
  const { client, user } = await ensureUser(project.oss_host, project.api_key, credentials);
  const admin = createClient({ baseUrl: project.oss_host, anonKey: project.api_key, isServerMode: true });
  const profileResult = await client.auth.setProfile({ name: "Equipo Citadely Demo", role: "business", onboarding_complete: true, business_name: "Consultorios Horizonte", business_category: "consultorio_clinico", business_slug: BUSINESS_SLUG });
  if (profileResult.error) throw new Error(profileResult.error.message);
  const business = await ensureBusiness(admin, user.id);
  // Con la admin key: el rate limit de reservas por IP no debe bloquear correr el E2E otra vez desde localhost.
  const attempts = await admin.database.from("public_booking_attempts").delete().eq("business_id", business.id);
  if (attempts.error) throw new Error(`No se pudieron limpiar los intentos de reserva: ${attempts.error.message}`);
  await resetDemoData(client, business.id);
  const counts = await seedDemoData(client, admin, business);
  const notification = await client.database.from("business_notification_settings").upsert([{ business_id: business.id, email: credentials.email }], { onConflict: "business_id" });
  if (notification.error) throw new Error(notification.error.message);
  console.log(JSON.stringify({ ok: true, business: { name: business.name, slug: business.slug }, counts }, null, 2));
}

await main();
