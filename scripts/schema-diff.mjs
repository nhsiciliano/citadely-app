#!/usr/bin/env node
// Compares the public schema of two InsForge projects (read-only: SELECTs and list commands only).
//
//   pnpm schema:diff                          linked backend branch  vs  its parent (branched_from)
//   pnpm schema:diff --right <project-id>     linked project         vs  another project
//   pnpm schema:diff --left <id> --right <id> any two cloud projects
//   pnpm schema:diff --left-file a.json --right-file b.json   compare saved snapshots
//   pnpm schema:diff --save-left a.json --save-right b.json   keep the snapshots
//   pnpm schema:diff --json                   machine-readable report
//
// Exit code: 0 = identical, 1 = differences, 2 = could not read a schema.
// "left" is the project you are about to promote FROM (the backend branch), "right" the one you promote TO
// (the parent / Production). Anything "only in left" must be applied to right before deploying.
//
// Projects other than the linked one are addressed through INSFORGE_PROJECT_ID, which the CLI honours
// for the logged-in user; this script never links, applies or writes anything.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const has = (name) => args.includes(`--${name}`);

const cliBin = existsSync("node_modules/.bin/insforge") ? ["node_modules/.bin/insforge"] : ["npx", "-y", "@insforge/cli"];

function cli(commandArgs, projectId) {
  const env = { ...process.env, NO_COLOR: "1" };
  if (projectId) env.INSFORGE_PROJECT_ID = projectId;
  const [bin, ...prefix] = cliBin;
  return execFileSync(bin, [...prefix, ...commandArgs], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function query(sql, projectId) {
  const output = cli(["db", "query", sql, "--json"], projectId);
  return JSON.parse(output).rows;
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

function readSnapshot(label, projectId) {
  const snapshot = { project: projectId ?? "linked", sections: {} };
  for (const section of SECTIONS) {
    snapshot.sections[section.name] = Object.fromEntries(query(section.sql, projectId).map((row) => [row.key, row.value]));
  }

  const migrations = JSON.parse(cli(["db", "migrations", "list", "--json"], projectId)).migrations ?? [];
  snapshot.sections.migrations = Object.fromEntries(migrations.map((migration) => [migration.version, migration.name]));

  // Informational: a schedule that exists on one side only usually means a duplicated or missing cron.
  const schedules = JSON.parse(cli(["schedules", "list", "--json"], projectId));
  snapshot.sections.schedules = Object.fromEntries(
    schedules.map((schedule) => [schedule.name, `${schedule.isActive ? "active" : "inactive"} ${schedule.cronSchedule} ${schedule.httpMethod} ${schedule.functionUrl}`]),
  );

  console.error(`[${label}] ${snapshot.project}: ${Object.values(snapshot.sections).reduce((sum, rows) => sum + Object.keys(rows).length, 0)} objects`);
  return snapshot;
}

function loadSide(label) {
  const file = flag(`${label}-file`);
  if (file) return JSON.parse(readFileSync(file, "utf8"));

  let projectId = flag(label);
  if (!projectId && label === "right") {
    const linked = JSON.parse(readFileSync(".insforge/project.json", "utf8"));
    projectId = linked.branched_from?.project_id;
    if (!projectId) {
      console.error("The linked project is not a backend branch (no branched_from). Pass --right <project-id> or --right-file.");
      process.exit(2);
    }
  }
  const snapshot = readSnapshot(label, projectId);
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

try {
  const left = loadSide("left");
  const right = loadSide("right");
  const report = diff(left, right);
  if (has("json")) console.log(JSON.stringify({ left: left.project, right: right.project, report }, null, 2));
  else printReport(report, left, right);
  process.exit(Object.keys(report).length ? 1 : 0);
} catch (error) {
  console.error(`schema-diff failed: ${error instanceof Error ? error.message : error}`);
  process.exit(2);
}
