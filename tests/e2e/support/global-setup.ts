import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { branchProject, env } from "./backend";
import { loadE2eEnvironment } from "./env";

// Runs once before the suite: refuses non-branch targets, then (re)creates the demo business the dashboard
// and booking specs rely on. The seed resets the demo data every time, so running it again is safe.
export default async function globalSetup() {
  loadE2eEnvironment();
  const project = branchProject();
  console.log(`E2E → backend branch "${project.projectName}" (derivado de "${project.parentName}"), corrida ${env("E2E_RUN_ID")}`);

  // The suite writes data: the operator must confirm the target by exporting its exact name (same rule as the seeds).
  if (process.env.SEED_CONFIRM_PROJECT !== project.projectName) {
    throw new Error(`Los E2E escriben datos en "${project.projectName}". Para confirmar, definí SEED_CONFIRM_PROJECT=${project.projectName}.`);
  }

  if (process.env.E2E_SKIP_SEED === "1") return;

  execFileSync(process.execPath, ["scripts/seed-citadely-demo.mjs"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "pipe",
    timeout: 180_000,
  });

  // The seed creates the demo credentials in .env.local when they are not provided by the environment.
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  env("CITADELY_DEMO_EMAIL");
  env("CITADELY_DEMO_PASSWORD");
}
