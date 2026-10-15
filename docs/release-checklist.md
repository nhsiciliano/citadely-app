# Release checklist (promoting to Production)

Production uses the **parent** InsForge project (`Citadely`). Development and Preview use a **backend branch**
(`feature-functionalities-improves` today). The branch is only a rehearsal: nothing reaches the parent until you
apply it there on purpose. Run this list before every deploy to Production that includes migrations or new
database-facing code.

## 1. Before merging to `main`

- [ ] CI is green (`checks` job: lint, typecheck, unit tests, build).
- [ ] Every new file in `migrations/` was applied to the backend branch and the feature was exercised there.
- [ ] Each migration is idempotent where practical (`if not exists`, `create or replace`) and does not depend on
      data that only exists in the branch.
- [ ] No migration copies another by hand (the old `sync-mercadopago-preview-schema` pattern). If the parent already
      has the change, the migration must be a no-op there.

## 2. Compare schemas

```bash
pnpm schema:diff            # linked backend branch (left) vs its parent (right)
```

Needs `npx @insforge/cli login` and the parent credentials in `.insforge/project.parent.json` (gitignored, next to
`project.json`). The script is read-only (catalog SELECTs and `list` commands). The CLI only talks to the project in
`<cwd>/.insforge/project.json` (it ignores `INSFORGE_PROJECT_ID`), so the script reads any non-linked project by
running the CLI from a temporary directory with a copy of that project's credentials; the checkout is never
re-linked. Before comparing it asks the CLI which project it resolved on each side and aborts with exit 2 if
the two sides are the same project. Exit code 1 means differences, 2 means an error. Options:
`--right <project-id>`, `--left <project-id>` (any id that has a `.insforge/project*.json` file), `--json`,
`--save-left/--save-right <file>`, `--left-file/--right-file <file>` to compare saved snapshots.

How to read it (left = branch, right = parent):

| Section | `+ only in left` | `- only in right` | `~ changed` |
|---|---|---|---|
| `migrations` | **Must be applied to the parent before the deploy** | Parent has something the branch lacks: investigate | n/a |
| `columns`, `constraints`, `indexes`, `functions`, `triggers`, `views` | Expected only for migrations listed above | Drift: someone changed the parent by hand | Definition drift |
| `policies`, `row-level-security`, `table-grants`, `column-grants` | Same as above; **review security impact first** | Drift, possibly a hole | Verify which side is correct |
| `schedules` | A cron that exists on the branch only | A cron in the parent that Vercel `vercel.ts` may now duplicate | Different URL/method/secret |

The only acceptable differences are the pending migrations of this release (and Preview-only data such as schedules
pointing at Preview URLs). Anything else is drift: resolve it with a migration, not a manual edit.

## 3. Apply to the parent first

- [ ] Take a backup: `npx -y @insforge/cli backups create --name pre-release-<date> --wait` (parent linked or
      `--project <id>`).
- [ ] Apply the pending migrations to the parent **before** deploying the app (the new code must never run against an
      older schema). Use the InsForge CLI from a checkout linked to the parent, or the dashboard SQL runner.
- [ ] Re-run `pnpm schema:diff`: the `migrations` section must show no `only in left` entries and the other sections
      only the differences you expect.

## 4. Deploy and verify

- [ ] Production environment variables in Vercel match `.env.example` (`[Prod+Preview]` entries); Preview-only entries
      (`MERCADOPAGO_PAYER_EMAIL`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `RESEND_SKIP_DELIVERY=true`) are absent from
      Production. `MERCADOPAGO_ACCESS_TOKEN` does not start with `TEST-` (the app refuses to start otherwise).
- [ ] Deploy. In Vercel → Settings → Cron Jobs the crons from `vercel.ts` appear and their first runs return 200.
- [ ] `npx -y @insforge/cli schedules list` on the parent shows no schedule that duplicates a Vercel cron.
- [ ] Smoke test: public booking page loads, a booking is created, the confirmation email is queued, login and the
      dashboard load.
- [ ] Check Sentry (if enabled) and the `failure-alerts` cron output for new `failed` rows.

## 5. Rollback

Code: promote the previous deployment in Vercel. Schema: forward-fix with a new migration; use the pre-release backup
only as a last resort (`backups restore` overwrites database **and** storage).
