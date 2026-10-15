// Pure comparison behind `pnpm schema:diff --check-migrations` (no I/O, unit-tested).
// repo:   migrations/ files            { version: name }
// branch: applied on the backend branch (left)   { version: name }
// parent: applied on the parent / Production (right) { version: name }

const MIGRATION_FILE = /^(\d{14})_([a-z0-9-]+)\.sql$/;

/** Parses migrations/ file names into { version: name }; returns the names that do not follow the format. */
export function parseMigrationFiles(fileNames) {
  const migrations = {};
  const invalid = [];
  for (const fileName of fileNames) {
    if (!fileName.endsWith(".sql")) continue;
    const match = MIGRATION_FILE.exec(fileName);
    if (match) migrations[match[1]] = match[2];
    else invalid.push(fileName);
  }
  return { migrations, invalid };
}

const label = (version, name) => `${version}_${name}`;

/**
 * Release invariants:
 * - every repo migration was applied (and rehearsed) on the branch;
 * - the branch has nothing applied by hand without a file in the repo;
 * - the parent has nothing the repo does not know about;
 * - same version, same name everywhere.
 * `pending` is what must be applied to the parent, in order.
 */
export function checkMigrations({ repo, branch, parent }) {
  const problems = [];
  for (const [version, name] of Object.entries(repo)) {
    if (!(version in branch)) problems.push(`Not applied to the branch: ${label(version, name)}`);
    else if (branch[version] !== name) problems.push(`Name differs on the branch: ${label(version, name)} vs ${label(version, branch[version])}`);
  }
  for (const [version, name] of Object.entries(branch)) {
    if (!(version in repo)) problems.push(`Applied to the branch without a file in migrations/: ${label(version, name)}`);
  }
  for (const [version, name] of Object.entries(parent)) {
    if (!(version in repo)) problems.push(`Applied to the parent without a file in migrations/: ${label(version, name)}`);
    else if (repo[version] !== name) problems.push(`Name differs on the parent: ${label(version, repo[version])} vs ${label(version, name)}`);
  }
  const pending = Object.keys(repo)
    .filter((version) => !(version in parent))
    .sort()
    .map((version) => label(version, repo[version]));
  const parentHead = Object.keys(parent).sort().at(-1);
  const outOfOrder = parentHead ? pending.filter((migration) => migration.slice(0, 14) < parentHead) : [];
  for (const migration of outOfOrder) {
    problems.push(`Pending but older than the parent head (${parentHead}); the CLI will refuse it: ${migration}`);
  }
  return { ok: problems.length === 0, problems, pending };
}
