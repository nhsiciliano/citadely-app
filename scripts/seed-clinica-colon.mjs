#!/usr/bin/env node

import fs from "node:fs";
import { createClient } from "@insforge/sdk";

const EMAIL = process.env.SEED_CLINICA_COLON_EMAIL ?? "nhsiciliano@gmail.com";
const PASSWORD = process.env.SEED_CLINICA_COLON_PASSWORD;
const BUSINESS_NAME = "Clínica Colon";
const BUSINESS_SLUG = "clinicacolon";
const BUSINESS_DESCRIPTION =
  "Clínica Colon es un centro de atención médica ambulatoria con profesionales de distintas especialidades. Brindamos consultas programadas, controles y seguimiento para adultos y niños, con turnos online de lunes a sábado según la especialidad.";
const DAYS_TO_SEED = 90;

const FAQS = [
  {
    question: "¿Cómo reservo un turno?",
    answer: "Elegí la especialidad, seleccioná una fecha y un horario disponible, y completá tus datos de contacto. La confirmación se muestra al finalizar la reserva.",
  },
  {
    question: "¿En qué horarios atiende la clínica?",
    answer: "La atención es de lunes a sábado, de 9:00 a 18:00, según los días disponibles de cada especialidad. Los turnos se ofrecen cada 20 minutos.",
  },
  {
    question: "¿Qué debo llevar a la consulta?",
    answer: "Traé DNI, credencial de cobertura médica si corresponde, estudios previos, lista de medicación actual y cualquier orden o derivación relacionada con la consulta.",
  },
  {
    question: "¿Atienden urgencias?",
    answer: "Clínica Colon trabaja con turnos programados y no funciona como guardia. Ante una urgencia médica, dirigite al servicio de emergencias más cercano.",
  },
  {
    question: "¿Puedo cancelar o cambiar mi turno?",
    answer: "Sí. Comunicate con la clínica con la mayor anticipación posible para cancelar o reprogramar el turno y liberar el horario para otra persona.",
  },
  {
    question: "¿Atienden obras sociales y prepagas?",
    answer: "Las coberturas dependen del profesional y la especialidad. Consultá con la clínica antes del turno para confirmar cobertura, autorización y posibles copagos.",
  },
];

const SERVICES = [
  {
    name: "Cardiología",
    doctor: "Dr. Martín Quiroga",
    description: "Consulta cardiológica con el Dr. Martín Quiroga para evaluación cardiovascular, control de presión arterial, seguimiento de factores de riesgo y revisión de estudios.",
    imageUrl: "https://cardiovaschn.com/wp-content/uploads/2021/08/servicios_cardiologia.jpg",
    weekdays: [1, 3, 4],
    priceCents: 4500000,
    color: "#c44747",
  },
  {
    name: "Traumatología",
    doctor: "Dra. Valentina Ríos",
    description: "Atención con la Dra. Valentina Ríos para lesiones musculares y articulares, dolor osteomuscular, controles postraumáticos y seguimiento de tratamientos.",
    imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjrnNmb5tpLkAM4Apt0dFkFLhYI6CCyeyVrFJmqRaHfA&s=10",
    weekdays: [2, 4, 5],
    priceCents: 4000000,
    color: "#3f6fa8",
  },
  {
    name: "Clínica médica",
    doctor: "Dr. Santiago Ferrer",
    description: "Consulta integral con el Dr. Santiago Ferrer para diagnóstico, controles generales, seguimiento de enfermedades crónicas y orientación preventiva.",
    imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTP8CrNrYXZRx6Amcesmvv2i89zfMyuZK0ctyc5-xKrew&s=10",
    weekdays: [3, 5, 6],
    priceCents: 3200000,
    color: "#3f8a68",
  },
  {
    name: "Dermatología",
    doctor: "Dra. Julieta Navarro",
    description: "Consulta con la Dra. Julieta Navarro para evaluación de piel, cabello y uñas, control de lunares y seguimiento de afecciones dermatológicas.",
    imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTjyCXAv0f9UVT2N2ZZwHphL4luTJLEG7n5820jw1_fqw&s=10",
    weekdays: [1, 2, 3],
    priceCents: 4200000,
    color: "#9b5f8f",
  },
  {
    name: "Pediatría",
    doctor: "Dra. Camila Benítez",
    description: "Atención pediátrica con la Dra. Camila Benítez para controles de crecimiento, seguimiento del desarrollo, consultas clínicas y orientación a familias.",
    imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSKNzfkbAVwdBOmZsCAHczSH14DP4kisuSRJjE7Plk3cQ&s=10",
    weekdays: [1, 2, 5, 6],
    priceCents: 3600000,
    color: "#d28b36",
  },
];

if (process.env.SEED_ALLOW_WRITE !== "true") {
  throw new Error("Set SEED_ALLOW_WRITE=true to write seed data to the linked InsForge project.");
}

if (!PASSWORD) {
  throw new Error("Set SEED_CLINICA_COLON_PASSWORD to sign in as the clinic owner.");
}

function readProjectConfig() {
  return JSON.parse(fs.readFileSync(".insforge/project.json", "utf8"));
}

function localDateKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateKeysFromTomorrow(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + index + 1);
    return localDateKey(date);
  });
}

function weekdayForDateKey(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

function serviceSlots(businessId, serviceId, weekdays) {
  return dateKeysFromTomorrow(DAYS_TO_SEED)
    .filter((dateKey) => weekdays.includes(weekdayForDateKey(dateKey)))
    .flatMap((dateKey) => {
      const slots = [];
      for (let minutes = 9 * 60; minutes < 18 * 60; minutes += 20) {
        const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
        const minute = String(minutes % 60).padStart(2, "0");
        const startsAt = new Date(`${dateKey}T${hour}:${minute}:00-03:00`);
        slots.push({
          business_id: businessId,
          service_id: serviceId,
          starts_at: startsAt.toISOString(),
          ends_at: new Date(startsAt.getTime() + 20 * 60_000).toISOString(),
          is_active: true,
        });
      }
      return slots;
    });
}

async function insertInBatches(client, table, rows, size = 500) {
  for (let index = 0; index < rows.length; index += size) {
    const { error } = await client.database.from(table).insert(rows.slice(index, index + size));
    if (error) throw new Error(`No se pudo insertar ${table}: ${error.message}`);
  }
}

async function main() {
  const project = readProjectConfig();
  const ownerClient = createClient({ baseUrl: project.oss_host, anonKey: project.api_key });
  const login = await ownerClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (login.error || !login.data?.user) {
    throw new Error(`No se pudo iniciar sesión como propietario: ${login.error?.message ?? "sin usuario"}`);
  }

  await ownerClient.auth.setProfile({
    name: BUSINESS_NAME,
    role: "business",
    onboarding_complete: true,
    business_name: BUSINESS_NAME,
    business_category: "clinica_medica",
    business_slug: BUSINESS_SLUG,
  });

  const admin = createClient({ baseUrl: project.oss_host, anonKey: project.api_key, isServerMode: true });
  const businessResult = await admin.database.from("businesses").select("*").eq("owner_id", login.data.user.id).single();
  if (businessResult.error || !businessResult.data) {
    throw new Error(`No se encontró Clínica Colon: ${businessResult.error?.message ?? "sin negocio"}`);
  }

  const business = businessResult.data;
  const businessUpdate = await admin.database.from("businesses").update({
    name: BUSINESS_NAME,
    slug: BUSINESS_SLUG,
    category: "clinica_medica",
    description: BUSINESS_DESCRIPTION,
    brand_color: "#176b75",
    timezone: "America/Argentina/Buenos_Aires",
    currency: "ARS",
    is_public: true,
  }).eq("id", business.id);
  if (businessUpdate.error) throw new Error(`No se pudo actualizar la clínica: ${businessUpdate.error.message}`);

  const existingServices = await admin.database.from("services").select("id").eq("business_id", business.id).in("name", SERVICES.map((service) => service.name));
  if (existingServices.error) throw new Error(`No se pudieron consultar servicios: ${existingServices.error.message}`);
  const serviceIds = (existingServices.data ?? []).map((service) => service.id);
  if (serviceIds.length > 0) {
    const deleteSlots = await admin.database.from("service_availability_slots").delete().in("service_id", serviceIds);
    if (deleteSlots.error) throw new Error(`No se pudo limpiar disponibilidad: ${deleteSlots.error.message}`);
    const deleteServices = await admin.database.from("services").delete().in("id", serviceIds);
    if (deleteServices.error) throw new Error(`No se pudieron limpiar servicios: ${deleteServices.error.message}`);
  }

  const existingEmployees = await admin.database.from("employees").select("id").eq("business_id", business.id).in("name", SERVICES.map((service) => service.doctor));
  if (existingEmployees.error) throw new Error(`No se pudieron consultar profesionales: ${existingEmployees.error.message}`);
  const employeeIds = (existingEmployees.data ?? []).map((employee) => employee.id);
  if (employeeIds.length > 0) {
    const deleteHours = await admin.database.from("working_hours").delete().in("employee_id", employeeIds);
    if (deleteHours.error) throw new Error(`No se pudieron limpiar horarios: ${deleteHours.error.message}`);
    const deleteEmployees = await admin.database.from("employees").delete().in("id", employeeIds);
    if (deleteEmployees.error) throw new Error(`No se pudieron limpiar profesionales: ${deleteEmployees.error.message}`);
  }

  const employeeResult = await admin.database.from("employees").insert(SERVICES.map((service) => ({
    business_id: business.id,
    name: service.doctor,
    color: service.color,
    is_active: true,
  }))).select("*");
  if (employeeResult.error || !employeeResult.data) throw new Error(`No se pudieron crear profesionales: ${employeeResult.error?.message ?? "sin datos"}`);

  const employeesByName = new Map(employeeResult.data.map((employee) => [employee.name, employee]));
  const hours = SERVICES.flatMap((service) => service.weekdays.map((weekday) => ({
    business_id: business.id,
    employee_id: employeesByName.get(service.doctor).id,
    weekday,
    start_time: "09:00:00",
    end_time: "18:00:00",
    is_active: true,
  })));
  await insertInBatches(admin, "working_hours", hours);

  const serviceResult = await admin.database.from("services").insert(SERVICES.map((service) => ({
    business_id: business.id,
    name: service.name,
    description: service.description,
    image_url: service.imageUrl,
    duration_minutes: 20,
    price_cents: service.priceCents,
    requires_payment: false,
    deposit_type: "free",
    deposit_value_cents: 0,
    is_active: true,
  }))).select("*");
  if (serviceResult.error || !serviceResult.data) throw new Error(`No se pudieron crear servicios: ${serviceResult.error?.message ?? "sin datos"}`);

  let slotCount = 0;
  for (const service of SERVICES) {
    const created = serviceResult.data.find((row) => row.name === service.name);
    const slots = serviceSlots(business.id, created.id, service.weekdays);
    await insertInBatches(admin, "service_availability_slots", slots);
    slotCount += slots.length;
  }

  const deleteFaqs = await admin.database.from("business_faqs").delete().eq("business_id", business.id);
  if (deleteFaqs.error) throw new Error(`No se pudieron limpiar preguntas frecuentes: ${deleteFaqs.error.message}`);
  await insertInBatches(admin, "business_faqs", FAQS.map((faq, sortOrder) => ({
    business_id: business.id,
    question: faq.question,
    answer: faq.answer,
    sort_order: sortOrder,
  })));

  const notification = await admin.database.from("business_notification_settings").upsert([
    { business_id: business.id, email: EMAIL },
  ], { onConflict: "business_id" });
  if (notification.error) throw new Error(`No se pudo guardar el email de notificaciones: ${notification.error.message}`);

  console.log(JSON.stringify({
    ok: true,
    business: { id: business.id, name: BUSINESS_NAME, slug: BUSINESS_SLUG },
    doctors: employeeResult.data.length,
    services: serviceResult.data.length,
    slots: slotCount,
    faqs: FAQS.length,
    seededDays: DAYS_TO_SEED,
  }, null, 2));
}

await main();
