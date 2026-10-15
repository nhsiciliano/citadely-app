// Shared access to the InsForge backend branch the E2E suite runs against. Everything here reads
// process.env only (see support/env.ts for how it is populated) and throws when a value is missing:
// a missing credential must fail the run, never skip a test.

export type Row = Record<string, unknown> & { id: string };

export function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} (ver docs/ci.md, sección E2E).`);
  return value;
}

/** Id shared by the whole run; data created by specs carries it so global teardown can delete it. */
export const RUN_ID = env("E2E_RUN_ID");

/**
 * The backend the specs write to. Refuses to run unless it is a backend branch (has a parent) and the app under
 * test talks to the same backend, so a misconfigured run can never touch Production.
 */
export function branchProject() {
  const host = env("E2E_INSFORGE_OSS_HOST");
  const name = env("E2E_INSFORGE_PROJECT_NAME");
  const parent = process.env.E2E_INSFORGE_BRANCHED_FROM;
  if (!parent) {
    throw new Error(`"${name}" no es un backend branch (falta E2E_INSFORGE_BRANCHED_FROM). Los E2E escriben datos y no corren contra el proyecto padre.`);
  }
  const appBackend = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  if (appBackend && new URL(appBackend).host !== new URL(host).host) {
    throw new Error(`La app apunta a ${new URL(appBackend).host} pero los E2E escriben en ${new URL(host).host}. Deben ser el mismo backend branch.`);
  }
  return { projectName: name, parentName: parent, ossHost: host, apiKey: env("E2E_INSFORGE_API_KEY") };
}

/** Admin request to `${oss_host}/api/<path>` (database/..., auth/...). */
export async function admin(path: string, init?: RequestInit) {
  const project = branchProject();
  const response = await fetch(`${project.ossHost}/api/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${project.apiKey}`,
      "Content-Type": "application/json",
      "x-api-key": project.apiKey,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`InsForge ${response.status} en ${path}: ${(await response.text()).slice(0, 300)}`);
  return response;
}

/** Admin request under /api/database/ (records/<table>?..., rpc/<fn>). */
export function adminRequest(path: string, init?: RequestInit) {
  return admin(`database/${path}`, init);
}

export async function adminRows(path: string) {
  return await (await admin(`database/records/${path}`)).json() as Row[];
}

export async function updateBusiness(id: string, values: Record<string, unknown>) {
  await adminRequest(`records/businesses?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(values) });
}
