import fs from "node:fs";
import readline from "node:readline/promises";

const PROJECT_FILE = ".insforge/project.json";
export const CONFIRM_VAR = "SEED_CONFIRM_PROJECT";

export function readLinkedProject() {
  if (!fs.existsSync(PROJECT_FILE)) {
    throw new Error(`No hay proyecto InsForge enlazado (${PROJECT_FILE}). Enlazá un backend branch de Preview con la CLI.`);
  }
  return JSON.parse(fs.readFileSync(PROJECT_FILE, "utf8"));
}

// Los seeds solo escriben en un backend branch (tiene branched_from). El proyecto padre es producción.
export function assertBackendBranch(project) {
  if (!project.branched_from) {
    throw new Error(
      `"${project.project_name}" no es un backend branch (falta branched_from en ${PROJECT_FILE}). ` +
        "Se niega a escribir datos de prueba en el proyecto padre.",
    );
  }
}

// Imprime el proyecto destino y pide confirmar escribiendo su nombre. En modo no interactivo
// (CI, Playwright, pipes) hay que definir SEED_CONFIRM_PROJECT=<project_name>.
export async function confirmSeedTarget(scriptName) {
  const project = readLinkedProject();
  assertBackendBranch(project);
  const name = project.project_name;

  console.log(`${scriptName} va a escribir datos en el backend branch "${name}" (${project.project_id}),`);
  console.log(`derivado de "${project.branched_from.project_name}".`);

  if (process.env[CONFIRM_VAR] === name) return project;
  if (!process.stdin.isTTY) {
    throw new Error(`Sin terminal interactiva. Para confirmar, definí ${CONFIRM_VAR}=${name}.`);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`Escribí el nombre del proyecto para continuar (${name}): `);
    if (answer.trim() !== name) throw new Error("El nombre no coincide. Cancelado sin escribir datos.");
  } finally {
    rl.close();
  }
  return project;
}
