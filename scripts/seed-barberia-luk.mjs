#!/usr/bin/env node

import fs from "node:fs";
import { createClient } from "@insforge/sdk";
import { confirmSeedTarget } from "./lib/seed-guard.mjs";

const EMAIL = process.env.SEED_BARBERIA_LUK_EMAIL;
if (!EMAIL) throw new Error("Set SEED_BARBERIA_LUK_EMAIL to the seed owner email.");
const PASSWORD = process.env.SEED_BARBERIA_LUK_PASSWORD;
const BUSINESS_NAME = "Barberia Luk";
const BUSINESS_SLUG = "barberia-luk";
const BUSINESS_CATEGORY = "barberia";
const BUSINESS_DESCRIPTION =
  "Barberia Luk combina cortes clásicos, barba perfilada y atención personalizada en un espacio tranquilo de barrio. Reservá tu turno online, elegí el horario disponible y asegurá tu lugar con seña.";
const BUSINESS_BRAND_COLOR = "#1f5f4b";
const BUSINESS_COVER_URL = "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1800&q=80";
const BUSINESS_WHATSAPP = "5491123456789";
const SEEDED_SERVICE_NAMES = ["Corte de pelo y barba", "Atencion Especial"];

await confirmSeedTarget("seed:barberia-luk");

if (!PASSWORD) {
  throw new Error("Set SEED_BARBERIA_LUK_PASSWORD to create or sign in as the seed user.");
}

function readProjectConfig() {
  return JSON.parse(fs.readFileSync(".insforge/project.json", "utf8"));
}

function cents(amount) {
  return amount * 100;
}

function addMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function july2026Dates(weekdays) {
  const dates = [];

  for (let day = 1; day <= 31; day += 1) {
    const date = new Date(Date.UTC(2026, 6, day, 12, 0, 0));
    if (weekdays.includes(date.getUTCDay())) {
      dates.push(`2026-07-${String(day).padStart(2, "0")}`);
    }
  }

  return dates;
}

function hourlyTimes(startHour, endHour) {
  const times = [];

  for (let hour = startHour; hour <= endHour; hour += 1) {
    times.push(`${String(hour).padStart(2, "0")}:00`);
  }

  return times;
}

async function ensureUserAndSession(baseUrl, anonKey) {
  const client = createClient({ baseUrl, anonKey });
  const login = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });

  if (!login.error && login.data?.user) {
    return { client, user: login.data.user, created: false };
  }

  const signup = await client.auth.signUp({
    email: EMAIL,
    password: PASSWORD,
    name: "Barberia Luk",
    redirectTo: "https://citadely-app.vercel.app/login",
  });

  if (signup.error) {
    throw new Error(`No se pudo crear o iniciar sesion con ${EMAIL}: ${signup.error.message}`);
  }

  const secondLogin = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });

  if (secondLogin.error || !secondLogin.data?.user) {
    throw new Error(
      `Usuario creado pero no se pudo iniciar sesion. Si la verificacion de email esta activa, verificalo o desactivala temporalmente. Detalle: ${secondLogin.error?.message ?? "sin sesion"}`,
    );
  }

  return { client, user: secondLogin.data.user, created: true };
}

async function ensureProfile(client) {
  const { error } = await client.auth.setProfile({
    name: "Barberia Luk",
    role: "business",
    onboarding_complete: true,
    business_name: BUSINESS_NAME,
    business_category: BUSINESS_CATEGORY,
    business_slug: BUSINESS_SLUG,
  });

  if (error) throw new Error(`No se pudo guardar el perfil: ${error.message}`);
}

async function ensureBusiness(client, userId) {
  const existing = await client.database
    .from("businesses")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();

  if (existing.error) throw new Error(`No se pudo consultar negocio: ${existing.error.message}`);

  const payload = {
    owner_id: userId,
    name: BUSINESS_NAME,
    slug: BUSINESS_SLUG,
    category: BUSINESS_CATEGORY,
    description: BUSINESS_DESCRIPTION,
    brand_color: BUSINESS_BRAND_COLOR,
    cover_image_url: BUSINESS_COVER_URL,
    whatsapp_phone: BUSINESS_WHATSAPP,
  };

  if (existing.data) {
    const updated = await client.database
      .from("businesses")
      .update(payload)
      .eq("id", existing.data.id)
      .select("*")
      .single();

    if (updated.error) throw new Error(`No se pudo actualizar negocio: ${updated.error.message}`);
    return updated.data;
  }

  const created = await client.database.from("businesses").insert([payload]).select("*").single();

  if (created.error || !created.data) {
    throw new Error(`No se pudo crear negocio: ${created.error?.message ?? "sin datos"}`);
  }

  return created.data;
}

async function createServiceWithSlots(client, businessId, service) {
  const inserted = await client.database
    .from("services")
    .insert([
      {
        business_id: businessId,
        name: service.name,
        description: service.description,
        image_url: "",
        duration_minutes: 60,
        price_cents: service.priceCents,
        requires_payment: true,
        deposit_type: "deposit",
        deposit_value_cents: Math.round(service.priceCents * 0.1),
        is_active: true,
      },
    ])
    .select("*")
    .single();

  if (inserted.error || !inserted.data) {
    throw new Error(`No se pudo crear servicio ${service.name}: ${inserted.error?.message ?? "sin datos"}`);
  }

  const slots = service.dates.flatMap((dateKey) =>
    service.times.map((time) => {
      const startsAt = `${dateKey}T${time}:00-03:00`;
      return {
        business_id: businessId,
        service_id: inserted.data.id,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: addMinutes(startsAt, 60),
        is_active: true,
      };
    }),
  );

  const slotInsert = await client.database.from("service_availability_slots").insert(slots);

  if (slotInsert.error) {
    await client.database.from("services").update({ is_active: false }).eq("id", inserted.data.id);
    throw new Error(`Servicio ${service.name} creado pausado; fallo disponibilidad: ${slotInsert.error.message}`);
  }

  return { id: inserted.data.id, name: inserted.data.name, slots: slots.length };
}

async function resetSeededServices(client, businessId) {
  const existing = await client.database
    .from("services")
    .select("id")
    .eq("business_id", businessId)
    .in("name", SEEDED_SERVICE_NAMES);

  if (existing.error) {
    throw new Error(`No se pudieron consultar servicios existentes: ${existing.error.message}`);
  }

  const serviceIds = (existing.data ?? []).map((service) => service.id).filter(Boolean);

  if (serviceIds.length === 0) {
    return { removedServices: 0, removedSlots: 0 };
  }

  const removedSlots = await client.database
    .from("service_availability_slots")
    .delete()
    .in("service_id", serviceIds);

  if (removedSlots.error) {
    throw new Error(`No se pudo limpiar disponibilidad previa: ${removedSlots.error.message}`);
  }

  const removedServices = await client.database
    .from("services")
    .delete()
    .in("id", serviceIds);

  if (removedServices.error) {
    throw new Error(`No se pudieron limpiar servicios previos: ${removedServices.error.message}`);
  }

  return { removedServices: serviceIds.length, removedSlots: null };
}

async function main() {
  const project = readProjectConfig();
  const { client, user, created } = await ensureUserAndSession(project.oss_host, project.api_key);

  await ensureProfile(client);
  const business = await ensureBusiness(client, user.id);

  const notification = await client.database
    .from("business_notification_settings")
    .upsert([{ business_id: business.id, email: EMAIL }], { onConflict: "business_id" });

  if (notification.error) {
    throw new Error(`No se pudo guardar email de notificaciones: ${notification.error.message}`);
  }

  const reset = await resetSeededServices(client, business.id);

  await client.database
    .from("businesses")
    .update({ payment_alias: "barberia.luk", payment_instructions: "Enviar comprobante por WhatsApp para confirmar la seña." })
    .eq("id", business.id);

  const mondayToFriday = [1, 2, 3, 4, 5];
  const saturday = [6];
  const services = [
    {
      name: "Corte de pelo y barba",
      description: "Servicio de barberia para corte de pelo, arreglo de barba, perfilado y terminacion. Duracion de 1 hora.",
      priceCents: cents(25_000),
      dates: july2026Dates(mondayToFriday),
      times: hourlyTimes(10, 18),
    },
    {
      name: "Atencion Especial",
      description: "Atencion especial de sabado para servicio completo de barberia con mayor dedicacion. Duracion de 1 hora.",
      priceCents: cents(40_000),
      dates: july2026Dates(saturday),
      times: hourlyTimes(10, 15),
    },
  ];

  const createdServices = [];
  for (const service of services) {
    createdServices.push(await createServiceWithSlots(client, business.id, service));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        user: { id: user.id, email: EMAIL, created },
        business: { id: business.id, name: business.name, slug: business.slug },
        reset,
        services: createdServices,
        publicUrl: `https://${business.slug}.citadely.com.ar`,
      },
      null,
      2,
    ),
  );
}

await main();
