import { admin, branchProject, RUN_ID } from "./backend";
import { loadE2eEnvironment } from "./env";

type IdRow = { id: string };

async function rows(path: string) {
  return await (await admin(`database/records/${path}`)).json() as IdRow[];
}

async function remove(path: string) {
  await admin(`database/records/${path}`, { method: "DELETE" });
}

const ids = (items: IdRow[]) => items.map((item) => item.id).join(",");

// Runs once after the suite: deletes what the specs created in the demo business, found by the run id they put in
// service names and client emails. Best effort and idempotent: a failure is reported but never fails the run.
export default async function globalTeardown() {
  loadE2eEnvironment();
  branchProject();

  const steps: [string, () => Promise<void>][] = [
    ["turnos", async () => {
      const clients = await rows(`clients?email=ilike.*${RUN_ID}*&select=id`);
      const services = await rows(`services?name=ilike.*${RUN_ID}*&select=id`);
      if (clients.length) await remove(`appointments?client_id=in.(${ids(clients)})`);
      if (services.length) await remove(`appointments?service_id=in.(${ids(services)})`);
    }],
    ["clientes", async () => {
      const clients = await rows(`clients?email=ilike.*${RUN_ID}*&select=id`);
      if (clients.length) await remove(`clients?id=in.(${ids(clients)})`);
    }],
    ["horarios y servicios", async () => {
      const services = await rows(`services?name=ilike.*${RUN_ID}*&select=id`);
      if (!services.length) return;
      await remove(`service_availability_slots?service_id=in.(${ids(services)})`);
      await remove(`services?id=in.(${ids(services)})`);
    }],
  ];

  for (const [label, step] of steps) {
    try {
      await step();
    } catch (error) {
      console.warn(`Limpieza E2E (${label}) incompleta: ${error instanceof Error ? error.message : error}`);
    }
  }
}
