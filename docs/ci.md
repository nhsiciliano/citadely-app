# CI

Workflow: `.github/workflows/ci.yml`. Runs on pull requests, pushes to `main` and `lead-development`, and manually.

## `checks` job (always)

`pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm run --if-present test:unit` → `pnpm build`.

- `pnpm test:unit` runs Vitest (`vitest.config.mts`) over `tests/unit/**/*.test.ts`. Unit tests never touch a backend: route handlers are tested with `@/lib/insforge-admin` mocked, env-dependent modules with `withEnv` from `tests/unit/helpers.ts`, and `server-only` is stubbed.
- The build uses placeholder `NEXT_PUBLIC_*` values and never contacts a backend.
- Make this job a **required status check** in the branch protection rule for `main` (Settings → Branches).

## `e2e` job (opt-in)

Playwright against a dedicated InsForge **backend branch**. It writes data, so it only runs when the repository
variable `E2E_ENABLED` is `true`, never for fork PRs, and one run at a time (`concurrency: e2e-backend-branch`).

Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Variable | `E2E_ENABLED` | `true` to turn the job on |
| Secret | `E2E_INSFORGE_PROJECT_JSON` | Full contents of `.insforge/project.json` of the backend branch (must contain `branched_from`; the job aborts otherwise) |
| Secret | `E2E_INSFORGE_BASE_URL` | `NEXT_PUBLIC_INSFORGE_BASE_URL` of the backend branch |
| Secret | `E2E_INSFORGE_ANON_KEY` | Anon key of the backend branch |
| Secret | `E2E_INSFORGE_API_KEY` | Admin API key of the backend branch |
| Secret | `E2E_ADMIN_PASSWORD` | Plain password the blog-editor spec types into the admin panel |
| Secret | `E2E_ADMIN_PASSWORD_HASH` | scrypt hash of that password (`ADMIN_PASSWORD_HASH` format, see `lib/blog-admin-auth.ts`) |
| Secret | `E2E_ADMIN_SESSION_SECRET` | Any random string (≥ 32 chars) |

Never use credentials of the parent (Production) project. Resend delivery is forced off (`RESEND_SKIP_DELIVERY=true`)
and Mercado Pago runs against the local mock in `tests/fixtures`.

Until task 7.2, the specs read `.env.local` / `.insforge/project.json` from disk, so the job recreates both from the
secrets above and runs `pnpm seed:demo` to create the demo account.

## E2E configuration (7.2)

The specs read **only `process.env`** (through `tests/e2e/support/backend.ts`) and fail, never skip, when a value is
missing. `playwright.config.ts` is the single place that touches files: it loads `.env.local` (without overriding the
environment) and, if `E2E_INSFORGE_*` is not set, derives it from `.insforge/project.json`.

| Variable | Meaning |
|---|---|
| `E2E_INSFORGE_OSS_HOST`, `E2E_INSFORGE_API_KEY`, `E2E_INSFORGE_PROJECT_NAME` | Backend branch the specs write to (admin access) |
| `E2E_INSFORGE_BRANCHED_FROM` | Parent project name. **Required**: without it the run aborts (never against Production). `NEXT_PUBLIC_INSFORGE_BASE_URL` must point at the same backend |
| `SEED_CONFIRM_PROJECT` | Must equal the backend branch name (explicit confirmation of the target) |
| `CITADELY_DEMO_EMAIL` / `CITADELY_DEMO_PASSWORD` | Demo owner. If unset, the seed generates them and appends them to `.env.local` |
| `E2E_ADMIN_PASSWORD` | Admin panel password for the blog/promo specs |
| `E2E_SKIP_SEED=1` | Skip the demo seed (already seeded) |
| `E2E_PROMO_BRANCH` | Optional: only run `promo-redemption-preview` against this backend branch (it also needs `RUN_PROMO_REDEMPTION=1`) |
| `E2E_RUN_ID` | Created per run; data the specs create carries it |

Lifecycle: `support/global-setup.ts` checks the guard and runs the idempotent demo seed once; `support/global-teardown.ts`
deletes what the run created in the demo business (appointments, clients, availability and services tagged with the run id).
Specs with their own users and businesses (`rls-matrix`, `ssr-auth`, `subscription-*`) clean up after themselves.

Specs are split by domain: `public-seo`, `public-contact`, `public-catalog`, `public-theme`, `dashboard-crud`,
`dashboard-responsive`, `booking-capacity`, `availability-editor`, `manual-appointments-rpc`, `subscription-plans`,
`subscription-mercadopago`, plus the isolated suites mentioned above.
