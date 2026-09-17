#!/usr/bin/env node

import fs from "node:fs";
import { createClient } from "@insforge/sdk";

const PRO_PRICE_ARS = 18_000;
const PAGE_SIZE = 100;
const writeEnabled = process.env.MIGRATE_SUBSCRIPTIONS_ALLOW_WRITE === "true";

function readProjectConfig() {
  return JSON.parse(fs.readFileSync(".insforge/project.json", "utf8"));
}

function readLocalEnv() {
  const source = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
  return Object.fromEntries(source.split(/\r?\n/).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

async function updatePreapproval(accessToken, externalId) {
  const response = await fetch(`https://api.mercadopago.com/preapproval/${externalId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: "Citadely - Plan Pro",
      auto_recurring: { transaction_amount: PRO_PRICE_ARS, currency_id: "ARS" },
    }),
  });
  if (!response.ok) throw new Error(`Mercado Pago ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

const project = readProjectConfig();
const env = readLocalEnv();
const expectedProject = process.env.MIGRATE_SUBSCRIPTIONS_CONFIRM_PROJECT;

if (writeEnabled && expectedProject !== project.project_id) {
  throw new Error("Para escribir, definí MIGRATE_SUBSCRIPTIONS_CONFIRM_PROJECT con el project_id enlazado.");
}

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN ?? env.MERCADOPAGO_ACCESS_TOKEN;
if (writeEnabled && !accessToken) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN.");

const baseUrl = `https://${project.appkey}.${project.region}.insforge.app`;
const admin = createClient({ baseUrl, anonKey: project.api_key, isServerMode: true });
const subscriptions = [];

for (let offset = 0; ; offset += PAGE_SIZE) {
  const { data, error } = await admin.database
    .from("businesses")
    .select("id, subscription_external_id, subscription_status, subscription_plan")
    .eq("subscription_status", "active")
    .not("subscription_external_id", "is", null)
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  subscriptions.push(...(data ?? []));
  if (!data || data.length < PAGE_SIZE) break;
}

console.log(`${writeEnabled ? "WRITE" : "DRY RUN"}: ${subscriptions.length} suscripciones activas para migrar a Pro ($18.000 ARS).`);
if (!writeEnabled) {
  process.exit(0);
}

let migrated = 0;
const failures = [];
for (const subscription of subscriptions) {
  try {
    await updatePreapproval(accessToken, subscription.subscription_external_id);
    const { error } = await admin.database.from("businesses").update({
      subscription_plan: "pro",
      pending_subscription_plan: null,
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
    if (error) throw new Error(error.message);
    migrated += 1;
    console.log(`✓ ${subscription.id}`);
  } catch (error) {
    failures.push({ businessId: subscription.id, error: error instanceof Error ? error.message : String(error) });
    console.error(`✗ ${subscription.id}: ${failures.at(-1).error}`);
  }
}

console.log(`Resultado: ${migrated} migradas, ${failures.length} fallidas.`);
if (failures.length > 0) process.exitCode = 1;
