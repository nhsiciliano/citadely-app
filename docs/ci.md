# CI

Workflow: `.github/workflows/ci.yml`. Runs on pull requests, pushes to `main` and `lead-development`, and manually.

## `checks` job (always)

`pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm run --if-present test:unit` → `pnpm build`.

- The unit-test step does nothing until a `test:unit` script exists (task 7.1).
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
