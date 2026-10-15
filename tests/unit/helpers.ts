import { vi } from "vitest";

/** Runs `load` with a clean module registry and the given env, so modules that read env at import time see it. */
export async function withEnv<T>(env: Record<string, string | undefined>, load: () => Promise<T>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) vi.stubEnv(key, "");
    else vi.stubEnv(key, value);
  }
  return load();
}
