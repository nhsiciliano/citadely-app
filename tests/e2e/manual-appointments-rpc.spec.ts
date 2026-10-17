import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

test("RPC de turnos manuales: propiedad, inserción directa y concurrencia", async () => {
  const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import { createClient } from "@insforge/sdk";
    import { randomUUID } from "node:crypto";
        const makeClient = () => createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL, anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY });
    const first = makeClient();
    const second = makeClient();
    const credentials = { email: process.env.CITADELY_DEMO_EMAIL, password: process.env.CITADELY_DEMO_PASSWORD };
    const logins = await Promise.all([first.auth.signInWithPassword(credentials), second.auth.signInWithPassword(credentials)]);
    if (logins.some((login) => login.error)) throw new Error("Demo login failed");
    const { data: business } = await first.database.from("businesses").select("id").eq("slug", "citadely-demo-ux").single();
    const { data: client } = await first.database.from("clients").select("id").eq("business_id", business.id).limit(1).single();
    const target = new Date();
    target.setDate(target.getDate() + 8);
    while (target.getDay() === 0 || target.getDay() === 6) target.setDate(target.getDate() + 1);
    target.setHours(17, 0, 0, 0);
    const { data: slots } = await first.database.from("service_availability_slots").select("service_id,starts_at,ends_at").eq("business_id", business.id).eq("starts_at", target.toISOString()).limit(1);
    if (slots?.length !== 1) throw new Error("Test slot missing");
    const slot = slots[0];
    const payload = { p_business_id: business.id, p_client_id: client.id, p_service_id: slot.service_id, p_starts_at: slot.starts_at };
    const anonymous = await makeClient().database.rpc("create_manual_appointment", payload);
    const foreign = await first.database.rpc("create_manual_appointment", { ...payload, p_business_id: randomUUID() });
    const direct = await first.database.from("appointments").insert([{ business_id: business.id, client_id: client.id, service_id: slot.service_id, starts_at: slot.starts_at, ends_at: slot.ends_at, status: "confirmed", source: "business" }]);
    const results = await Promise.all([first.database.rpc("create_manual_appointment", payload), second.database.rpc("create_manual_appointment", payload)]);
    const { data: created } = await first.database.from("appointments").select("id").eq("business_id", business.id).eq("starts_at", slot.starts_at);
    process.stdout.write(JSON.stringify({ anonymousDenied: !!anonymous.error, foreignDenied: /no autorizado/i.test(foreign.error?.message ?? ""), directDenied: !!direct.error, successes: results.filter((item) => !item.error).length, conflict: results.some((item) => /ocupado|cupos|superpone/i.test(item.error?.message ?? "")), count: created?.length }));
  `], { cwd: process.cwd(), encoding: "utf8", timeout: 60_000 });
  expect(JSON.parse(result)).toEqual({ anonymousDenied: true, foreignDenied: true, directDenied: true, successes: 1, conflict: true, count: 1 });
});
