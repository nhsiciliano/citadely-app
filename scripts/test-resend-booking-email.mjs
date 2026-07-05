#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_EMAIL = "Citadely Dev <onboarding@resend.dev>";
const SCENARIOS = {
  delivered: "delivered+citadely-booking@resend.dev",
  bounced: "bounced+citadely-booking@resend.dev",
  complained: "complained+citadely-booking@resend.dev",
  suppressed: "suppressed@resend.dev",
};

function readDotEnvValue(key) {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;

    const line = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${key}=`));

    if (!line) continue;

    return line
      .slice(key.length + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }

  return "";
}

function formatIcsDate(date) {
  return date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function buildIcs(now) {
  const startsAt = new Date(now.getTime() + 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  const uid = `citadely-dev-${now.getTime()}@citadely.local`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Citadely//Resend Dev Test//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:America/Argentina/Buenos_Aires",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(startsAt)}`,
    `DTEND:${formatIcsDate(endsAt)}`,
    "SUMMARY:Reserva de prueba - Citadely Dev",
    "DESCRIPTION:Email sandbox para validar Resend API con adjunto ICS.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function getScenario() {
  const rawScenario = process.argv[2] ?? "delivered";

  if (!Object.hasOwn(SCENARIOS, rawScenario)) {
    console.error(`Escenario invalido: ${rawScenario}`);
    console.error(`Usa uno de: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }

  return rawScenario;
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY || readDotEnvValue("RESEND_API_KEY");

  if (!apiKey) {
    console.error("Falta RESEND_API_KEY en el entorno, .env.local o .env.");
    process.exit(1);
  }

  const scenario = getScenario();
  const to = SCENARIOS[scenario];
  const now = new Date();
  const subject = `Citadely Resend dev ${scenario} ${now.toISOString()}`;
  const ics = buildIcs(now);

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#18211d">
          <h1>Prueba Resend Citadely</h1>
          <p>Este email valida el envio por API en desarrollo sin verificar citadely.com.ar.</p>
          <p><strong>Escenario:</strong> ${scenario}</p>
          <p><strong>Destino:</strong> ${to}</p>
        </div>
      `,
      text: [
        "Prueba Resend Citadely",
        "Este email valida el envio por API en desarrollo sin verificar citadely.com.ar.",
        `Escenario: ${scenario}`,
        `Destino: ${to}`,
      ].join("\n"),
      attachments: [
        {
          filename: "citadely-dev-booking.ics",
          content: Buffer.from(ics, "utf8").toString("base64"),
        },
      ],
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          status: response.status,
          scenario,
          to,
          error: body,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: body?.id,
        scenario,
        from: FROM_EMAIL,
        to,
        subject,
        attachment: "citadely-dev-booking.ics",
      },
      null,
      2,
    ),
  );
}

await main();
