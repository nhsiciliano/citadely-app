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

- [ ] `pnpm test:e2e tests/e2e/rls-matrix.spec.ts` against the branch is green
      (access matrix: anon / owner / other owner per table and RPC, plus the integrity triggers).
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
      (`VERCEL_AUTOMATION_BYPASS_SECRET`, `RESEND_SKIP_DELIVERY=true`) are absent from
      Production. `MERCADOPAGO_ACCESS_TOKEN` does not start with `TEST-` (the app refuses to start otherwise).
- [ ] Deploy. In Vercel → Settings → Cron Jobs the list is empty: `vercel.ts` declares `crons: []` and every cron runs
      as an InsForge schedule (Hobby only allows daily crons; a more frequent one makes the deploy fail).
- [ ] InsForge secret `CRON_SECRET` exists in the parent and matches the Vercel Production `CRON_SECRET`
      (`npx -y @insforge/cli secrets list`).
- [ ] `Citadely transactional email` (id `6cc3b1f4`) already exists in the parent and returns 200 every minute: do not
      recreate it (the duplicate copy that the backend branch inherited was deleted on 2026-10-16). In the parent create the two missing ones, `Citadely cancel expired deposits` and
      `Citadely failure alerts` (exact commands in README → Crons).
- [ ] Verify the three in the parent: `npx -y @insforge/cli schedules list` shows them active with the right cron, URL
      (`https://www.citadely.com.ar/api/cron/<route>`) and `POST`, and `schedules logs <id>` shows a 200 run for each.
- [ ] Smoke test: public booking page loads, a booking is created, the confirmation email is queued, login and the
      dashboard load.
- [ ] Check Sentry (if enabled) and the `failure-alerts` cron output for new `failed` rows.

## 5. Rollback

Code: promote the previous deployment in Vercel. Schema: forward-fix with a new migration; use the pre-release backup
only as a last resort (`backups restore` overwrites database **and** storage).

## Free product release (landing + voluntary contributions)

The release that makes Citadely free (Astro landing, voluntary contributions through Mercado Pago Checkout Pro, no
subscriptions, plans, trial, promo codes or read-only mode) is one window, with the landing before the product change
in git. Migrations: M1 `20261024120000_open-access-for-free-product.sql` and M2 `20261024120100_add-contributions.sql`
are safe with the old code; M3 `20261024120200_drop-subscriptions-and-promo-codes.sql` is not (the old code needs the
columns it drops), so it goes last and the code can only be rolled back while M3 is not applied.

1. **Rehearsal on the backend branch.** M1–M3 applied, the full E2E suite green (including `rls-matrix` and
   `contributions`), and `pnpm schema:diff --check-migrations` shows only M1–M3 pending for the parent.
2. **Landing in production.** The `citadely-landing` project is deployed and `LANDING_ORIGIN` is set in Next
   (Production and Preview) before the merge: `curl -I https://landing.citadely.com.ar/politica-de-privacidad/` returns 200.
3. **Parent: backup and M1 + M2.** `npx -y @insforge/cli backups create --name pre-free-<date> --wait`, then apply M1 and
   M2 (the wrapper `claim_subscription_webhook_event` keeps the old webhook working until the deploy).
4. **PR `lead-development` → `main`, merge and deploy.** Smoke: `/` serves Astro with its CSS from `/landing-assets/`,
   the legal pages, `https://<slug>.citadely.com.ar/` still shows the business page, `/sitemap.xml` and `/robots.txt`
   are unchanged, `/negocio/configuracion` shows the contributions section, and a real $1.000 contribution reaches
   `approved` through the webhook (confirm in the Mercado Pago panel that the **Pagos** topic is enabled on the same
   webhook URL).
5. **Subscriptions already created in Mercado Pago.** There is no cancel script: the owner deletes by hand the
   businesses that still have a preapproval (they are not professional accounts) and checks Mercado Pago. Their
   `subscription_preapproval` webhooks are `ignored` by the new webhook.
6. **Parent: M3 and cleanup.** Apply M3; `pnpm schema:diff --check-migrations` prints `Nothing pending for the parent`;
   remove `MERCADOPAGO_PAYER_EMAIL` from Vercel Preview; Vercel → Settings → Cron Jobs is empty; the Firewall rule is
   re-pointed to `/api/public-booking` OR `/api/contributions/checkout` (see `docs/anti-abuse.md`) and published.
7. **24 h monitoring.** `failure-alerts` output, Sentry and `mercadopago_webhook_events` rows in `failed`; check that a
   commit that only touches `app/` does not build the landing project.

## Changing the suggested contribution amounts

`public.contribution_options` holds the suggested amounts shown in Settings (`code`, `label`, `amount_cents`, `sort_order`,
`is_active`). To change one, in one migration: set the current row of that `code` to `is_active = false` and insert a new
active row with the new `amount_cents` (amounts are in centavos). Keep the old row: past contributions reference its
`option_code`. The limits of the free amount ("Otro importe") are the CHECK on `contributions.amount_cents` and the
constants in `lib/contributions.ts`; change both together, in the same release.
