import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

/**
 * The one place where E2E configuration comes from files. playwright.config.ts calls this once; every
 * spec reads process.env (through support/backend.ts) and fails loudly when something is missing.
 *
 *  - `.env.local` is loaded without overriding variables that are already set (local convenience).
 *  - If the E2E_INSFORGE_* variables are not set, they are derived from `.insforge/project.json`
 *    (the linked backend branch). In CI they come from secrets and no file is needed.
 *  - E2E_RUN_ID is created once per run so every worker tags the data it creates with the same id.
 */
export function loadE2eEnvironment() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  if (!process.env.E2E_INSFORGE_OSS_HOST && existsSync(".insforge/project.json")) {
    const project = JSON.parse(readFileSync(".insforge/project.json", "utf8")) as {
      project_name?: string;
      oss_host?: string;
      api_key?: string;
      branched_from?: { project_name?: string } | null;
    };
    process.env.E2E_INSFORGE_OSS_HOST = project.oss_host ?? "";
    process.env.E2E_INSFORGE_API_KEY ??= project.api_key ?? "";
    process.env.E2E_INSFORGE_PROJECT_NAME ??= project.project_name ?? "";
    process.env.E2E_INSFORGE_BRANCHED_FROM ??= project.branched_from?.project_name ?? "";
  }

  process.env.E2E_RUN_ID ??= `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
}
