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

## 2. Compare schemas (mandatory gate)

```bash
pnpm schema:diff --check-migrations   # linked backend branch (left) vs its parent (right), plus migrations/
```

There is no "apply every migration to an empty project" test: the InsForge plan has no room for another backend
branch, and creating or deleting branches is not part of this process. This gate replaces it. `--check-migrations`
compares the files in `migrations/` with the migrations applied on each side and fails (exit 1) if:

- a file in `migrations/` was not applied to the branch (it was never rehearsed);
- the branch has a migration applied without a file in `migrations/` (someone applied SQL that is not in git, or the
  file is still on an unmerged branch);
- the parent has a migration that is not in `migrations/` (a manual change in Production);
- a version has different names on different sides, or a pending file is older than the parent's newest migration
  (the CLI refuses to apply it; rename it with a newer timestamp).

It then prints the pending migrations for the parent, in the order they must be applied. Those are the only
acceptable differences in the `migrations` section; every difference in the other sections must be explained by them.

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
| `schedules` | A cron that exists on the branch only (create it in the parent at release, step 4) | A cron in the parent that the branch lacks | Different URL/method/secret |

The only acceptable differences are the pending migrations of this release (and Preview-only data such as schedules
pointing at Preview URLs). Anything else is drift: resolve it with a migration, not a manual edit.

## 3. Apply to the parent first

- [ ] `pnpm test:e2e tests/e2e/rls-matrix.spec.ts tests/e2e/subscription-read-only.spec.ts` against the branch is green
      (access matrix: anon / owner / other owner / expired owner per table and RPC, plus the integrity triggers).
- [ ] Take a backup: `npx -y @insforge/cli backups create --name pre-release-<date> --wait` (parent linked or
      `--project <id>`).
- [ ] Apply the pending migrations listed by step 2 to the parent, **one by one and in that order**, **before**
      deploying the app (the new code must never run against an older schema). Use the InsForge CLI from a checkout
      linked to the parent (`npx -y @insforge/cli db migrations up <file>`), or the dashboard SQL runner. Stop at the
      first failure: forward-fix with a new migration, applied to the branch first.
- [ ] Re-run `pnpm schema:diff --check-migrations`: it must print `Nothing pending for the parent` and exit 0 (no
      differences in any section, other than Preview-only schedules).

## 4. Deploy and verify

- [ ] Production environment variables in Vercel match `.env.example` (`[Prod+Preview]` entries); Preview-only entries
      (`MERCADOPAGO_PAYER_EMAIL`, `VERCEL_AUTOMATION_BYPASS_SECRET`, `RESEND_SKIP_DELIVERY=true`) are absent from
      Production. `MERCADOPAGO_ACCESS_TOKEN` does not start with `TEST-` (the app refuses to start otherwise).
- [ ] Deploy. In Vercel → Settings → Cron Jobs only the daily cron from `vercel.ts` (`reconcile-subscriptions`) appears
      (Hobby only allows daily crons; a more frequent one makes the deploy fail).
- [ ] InsForge secret `CRON_SECRET` exists in the parent and matches the Vercel Production `CRON_SECRET`
      (`npx -y @insforge/cli secrets list`).
- [ ] `Citadely transactional email` (id `6cc3b1f4`) already exists in the parent and returns 200 every minute: do not
      recreate it. In the parent create the two missing ones, `Citadely cancel expired deposits` and
      `Citadely failure alerts` (exact commands in README → Crons).
- [ ] The identical copy of `Citadely transactional email` in the backend branch is a duplicate (both fire against
      production). Once the parent's one is confirmed with 200 in `schedules logs 6cc3b1f4`, delete the branch copy.
- [ ] Verify the three in the parent: `npx -y @insforge/cli schedules list` shows them active with the right cron, URL
      (`https://www.citadely.com.ar/api/cron/<route>`) and `POST`, and `schedules logs <id>` shows a 200 run for each.
- [ ] Smoke test: public booking page loads, a booking is created, the confirmation email is queued, login and the
      dashboard load.
- [ ] Check Sentry (if enabled) and the `failure-alerts` cron output for new `failed` rows.

## 5. Rollback

Code: promote the previous deployment in Vercel. Schema: forward-fix with a new migration; use the pre-release backup
only as a last resort (`backups restore` overwrites database **and** storage).

## Changing subscription prices

`public.subscription_plans` is the only source of prices (landing, Settings, Mercado Pago checkout and
`apply_mercadopago_subscription_payment`). To change a price, in one migration: set the current row of that `code` to
`is_active = false` and insert a new active row with the new `amount_cents`. Keep the old row: subscribers still
paying the old preapproval amount keep being recognised. Existing Mercado Pago preapprovals are not updated
automatically; new checkouts and plan changes use the new price. The landing page refreshes within 5 minutes.
