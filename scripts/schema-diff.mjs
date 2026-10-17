#!/usr/bin/env node
// Compares the public schema of two InsForge projects (read-only: SELECTs and list commands only).
//
//   pnpm schema:diff                          linked backend branch  vs  its parent (branched_from)
//   pnpm schema:diff --right <project-id>     linked project         vs  another project
//   pnpm schema:diff --left <id> --right <id> any two cloud projects
//   pnpm schema:diff --left-file a.json --right-file b.json   compare saved snapshots
//   pnpm schema:diff --save-left a.json --save-right b.json   keep the snapshots
//   pnpm schema:diff --json                   machine-readable report
//   pnpm schema:diff --check-migrations       also verify migrations/ against both sides (release gate)
//
// Exit code: 0 = identical, 1 = differences, 2 = could not read a schema.
// "left" is the project you are about to promote FROM (the backend branch), "right" the one you promote TO
// (the parent / Production). Anything "only in left" must be applied to right before deploying.
//
// The CLI always talks to the project in <cwd>/.insforge/project.json (it ignores INSFORGE_PROJECT_ID).
// The linked project is read from this checkout; any other project is read by running the CLI from a temporary
// directory holding a copy of that project's credentials, taken from a sibling file `.insforge/project*.json`
// (e.g. project.parent.json). The checkout is never re-linked and nothing is ever applied or written.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkMigrations, parseMigrationFiles } from "./lib/migration-check.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const has = (name) => args.includes(`--${name}`);

const repoRoot = process.cwd();
const cliBin = existsSync(path.join(repoRoot, "node_modules/.bin/insforge"))
  ? [path.join(repoRoot, "node_modules/.bin/insforge")]
  : ["npx", "-y", "@insforge/cli"];
const tempDirs = [];

process.on("exit", () => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

// A "context" is a directory whose .insforge/project.json selects the project the CLI will talk to.
function contextFor(projectId) {
  const linked = readJson(path.join(repoRoot, ".insforge/project.json"));
  if (!projectId || projectId === linked.project_id) return { cwd: repoRoot, projectId: linked.project_id, name: linked.project_name };

  const credentialFiles = readdirSync(path.join(repoRoot, ".insforge")).filter((file) => /^project.*\.json$/.test(file));
  for (const file of credentialFiles) {
    const credentials = readJson(path.join(repoRoot, ".insforge", file));
    if (credentials.project_id !== projectId) continue;
    const cwd = mkdtempSync(path.join(tmpdir(), "schema-diff-"));
    tempDirs.push(cwd);
    mkdirSync(path.join(cwd, ".insforge"));
    cpSync(path.join(repoRoot, ".insforge", file), path.join(cwd, ".insforge/project.json"));
    return { cwd, projectId, name: credentials.project_name };
  }
  throw new Error(`No credentials for project ${projectId}: expected a .insforge/project*.json file with that project_id.`);
}

function cli(commandArgs, context) {
  const [bin, ...prefix] = cliBin;
  return execFileSync(bin, [...prefix, ...commandArgs], {
    cwd: context.cwd,
    env: { ...process.env, NO_COLOR: "1" },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function query(sql, context) {
  return JSON.parse(cli(["db", "query", sql, "--json"], context)).rows;
}

// Guard against reading the wrong project: ask the CLI which project it resolved for this context.
function assertResolvedProject(context) {
  const resolved = JSON.parse(cli(["current", "--json"], context)).project?.project_id;
  if (resolved !== context.projectId) throw new Error(`The CLI resolved project ${resolved}, expected ${context.projectId}.`);
}

const PUBLIC_TABLES = `c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')`;

// Each section returns rows { key, value }: a stable identity and a normalised definition.
const SECTIONS = [
  {
    name: "columns",
    sql: `select table_name || '.' || column_name as key,
            concat_ws(' ', udt_name, case when is_nullable = 'NO' then 'not null' end, 'default', coalesce(column_default, '-')) as value
          from information_schema.columns where table_schema = 'public'`,
  },
  {
    name: "constraints",
    sql: `select c.conrelid::regclass::text || ' ' || c.conname as key, pg_get_constraintdef(c.oid) as value
          from pg_constraint c where c.connamespace = 'public'::regnamespace`,
  },
  {
    name: "indexes",
    sql: `select tablename || ' ' || indexname as key, indexdef as value from pg_indexes where schemaname = 'public'`,
  },
  {
    name: "functions",
    sql: `select p.oid::regprocedure::text as key,
            concat_ws(' ', case when p.prosecdef then 'security-definer' else 'invoker' end,
              'acl=' || coalesce(p.proacl::text, 'default'), 'body=' || md5(pg_get_functiondef(p.oid))) as value
          from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
            and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`,
  },
  {
    name: "triggers",
    sql: `select t.tgrelid::regclass::text || ' ' || t.tgname as key, pg_get_triggerdef(t.oid) as value
          from pg_trigger t join pg_class c on c.oid = t.tgrelid
          where not t.tgisinternal and ${PUBLIC_TABLES}`,
  },
  {
    name: "row-level-security",
    sql: `select c.relname as key, concat_ws(' ', case when c.relrowsecurity then 'enabled' else 'DISABLED' end,
            case when c.relforcerowsecurity then 'forced' end) as value
          from pg_class c where ${PUBLIC_TABLES}`,
  },
  {
    name: "policies",
    sql: `select tablename || ' ' || policyname as key,
            concat_ws(' | ', cmd, permissive, roles::text, 'using ' || coalesce(qual, '-'), 'check ' || coalesce(with_check, '-')) as value
          from pg_policies where schemaname = 'public'`,
  },
  {
    name: "table-grants",
    sql: `select table_name || ' ' || grantee as key, string_agg(privilege_type, ',' order by privilege_type) as value
          from information_schema.role_table_grants
          where table_schema = 'public' and grantee in ('anon', 'authenticated')
          group by table_name, grantee`,
  },
  {
    name: "column-grants",
    sql: `select table_name || ' ' || grantee || ' ' || privilege_type as key, string_agg(column_name, ',' order by column_name) as value
          from information_schema.column_privileges
          where table_schema = 'public' and grantee in ('anon', 'authenticated')
          group by table_name, grantee, privilege_type`,
  },
  {
    name: "views",
    sql: `select viewname as key, md5(definition) as value from pg_views where schemaname = 'public'`,
  },
];

function readSnapshot(label, context) {
  const snapshot = { project: `${context.name} (${context.projectId})`, projectId: context.projectId, sections: {} };
  for (const section of SECTIONS) {
    snapshot.sections[section.name] = Object.fromEntries(query(section.sql, context).map((row) => [row.key, row.value]));
  }

  const migrations = JSON.parse(cli(["db", "migrations", "list", "--json"], context)).migrations ?? [];
  snapshot.sections.migrations = Object.fromEntries(migrations.map((migration) => [migration.version, migration.name]));

  // Informational: a schedule that exists on one side only usually means a duplicated or missing cron.
  const schedules = JSON.parse(cli(["schedules", "list", "--json"], context));
  snapshot.sections.schedules = Object.fromEntries(
    schedules.map((schedule) => [schedule.name, `${schedule.isActive ? "active" : "inactive"} ${schedule.cronSchedule} ${schedule.httpMethod} ${schedule.functionUrl}`]),
  );

  console.error(`[${label}] ${snapshot.project}: ${Object.values(snapshot.sections).reduce((sum, rows) => sum + Object.keys(rows).length, 0)} objects`);
  return snapshot;
}

function resolveContext(label) {
  let projectId = flag(label);
  if (!projectId && label === "right") {
    projectId = readJson(path.join(repoRoot, ".insforge/project.json")).branched_from?.project_id;
    if (!projectId) {
      console.error("The linked project is not a backend branch (no branched_from). Pass --right <project-id> or --right-file.");
      process.exit(2);
    }
  }
  return contextFor(projectId);
}

function loadSide(label, file, context) {
  if (file) return readJson(file);
  assertResolvedProject(context);
  const snapshot = readSnapshot(label, context);
  const saveTo = flag(`save-${label}`);
  if (saveTo) writeFileSync(saveTo, JSON.stringify(snapshot, null, 2));
  return snapshot;
}

function diff(left, right) {
  const report = {};
  for (const name of new Set([...Object.keys(left.sections), ...Object.keys(right.sections)])) {
    const a = left.sections[name] ?? {};
    const b = right.sections[name] ?? {};
    const entries = [];
    for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (!(key in b)) entries.push({ kind: "only-left", key, left: a[key] });
      else if (!(key in a)) entries.push({ kind: "only-right", key, right: b[key] });
      else if (a[key] !== b[key]) entries.push({ kind: "changed", key, left: a[key], right: b[key] });
    }
    if (entries.length) report[name] = entries;
  }
  return report;
}

function printReport(report, left, right) {
  const total = Object.values(report).reduce((sum, entries) => sum + entries.length, 0);
  console.log(`Schema diff\n  left : ${left.project}\n  right: ${right.project}\n`);
  if (!total) return console.log("No differences.");

  const trim = (raw) => {
    const value = raw.replace(/\s+/g, " ");
    return value.length > 220 ? `${value.slice(0, 220)}…` : value;
  };
  for (const [name, entries] of Object.entries(report)) {
    console.log(`## ${name} (${entries.length})`);
    for (const entry of entries) {
      if (entry.kind === "only-left") console.log(`  + only in left : ${entry.key}\n      ${trim(entry.left)}`);
      if (entry.kind === "only-right") console.log(`  - only in right: ${entry.key}\n      ${trim(entry.right)}`);
      if (entry.kind === "changed") console.log(`  ~ changed      : ${entry.key}\n      left : ${trim(entry.left)}\n      right: ${trim(entry.right)}`);
    }
    console.log("");
  }
  console.log(`${total} difference(s).`);
}

// left = the branch being promoted, right = the parent. Compares both against the files in migrations/.
function runMigrationCheck(left, right) {
  const { migrations: repo, invalid } = parseMigrationFiles(readdirSync(path.join(repoRoot, "migrations")));
  const result = checkMigrations({ repo, branch: left.sections.migrations ?? {}, parent: right.sections.migrations ?? {} });
  return { ...result, ok: result.ok && invalid.length === 0, problems: [...invalid.map((file) => `Invalid file name in migrations/: ${file}`), ...result.problems] };
}

function printMigrationCheck(check) {
  console.log("\n## migration check (migrations/ vs branch vs parent)");
  for (const problem of check.problems) console.log(`  ! ${problem}`);
  if (check.pending.length) {
    console.log(`  Pending for the parent, apply in this order (${check.pending.length}):`);
    for (const migration of check.pending) console.log(`    ${migration}.sql`);
  } else console.log("  Nothing pending for the parent.");
  console.log(check.ok ? "  OK: the only migration differences are the pending files above." : "  FAILED: fix the problems above before releasing.");
  console.log("  The other sections above must be explained by those pending migrations; anything else is drift.");
}

try {
  const leftFile = flag("left-file");
  const rightFile = flag("right-file");
  const leftContext = leftFile ? undefined : resolveContext("left");
  const rightContext = rightFile ? undefined : resolveContext("right");
  if (leftContext && rightContext && leftContext.projectId === rightContext.projectId) {
    console.error(`Both sides resolve to the same project (${leftContext.name}, ${leftContext.projectId}); nothing to compare.`);
    process.exit(2);
  }
  const left = loadSide("left", leftFile, leftContext);
  const right = loadSide("right", rightFile, rightContext);
  if (left.projectId && left.projectId === right.projectId) {
    console.error(`Both snapshots come from the same project (${left.project}); nothing to compare.`);
    process.exit(2);
  }
  const report = diff(left, right);
  const migrationCheck = has("check-migrations") ? runMigrationCheck(left, right) : null;
  if (has("json")) console.log(JSON.stringify({ left: left.project, right: right.project, report, migrationCheck }, null, 2));
  else {
    printReport(report, left, right);
    if (migrationCheck) printMigrationCheck(migrationCheck);
  }
  if (migrationCheck && !migrationCheck.ok) process.exit(1);
  // With --check-migrations, pending migrations of this release are the expected difference, not a failure.
  const unexpected = migrationCheck ? Object.keys(report).filter((name) => name !== "migrations") : Object.keys(report);
  process.exit(unexpected.length ? 1 : 0);
} catch (error) {
  console.error(`schema-diff failed: ${error instanceof Error ? error.message : error}`);
  process.exit(2);
}
