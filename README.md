# Citadely

Central de turnos para negocios: agenda, servicios, clientes, página pública de reservas y suscripción mensual.

## Stack

- **Next.js 16** (App Router) sobre Node 24, desplegado en **Vercel**.
- **InsForge** como backend: Postgres con RLS, auth, storage y funciones. El proyecto enlazado está en `.insforge/project.json` (no se commitea).
- **Mercado Pago** para la suscripción de los negocios y **Resend** para emails transaccionales.
- **pnpm** es el único gestor de paquetes (`packageManager` en `package.json`). No usar npm ni yarn.

## Puesta en marcha

```bash
pnpm install
cp .env.example .env.local   # completar; ver la tabla de variables abajo
pnpm dev                     # http://localhost:3000
```

Para trabajar contra la base, enlazá la carpeta a un **backend branch** de InsForge con la CLI (`npx -y @insforge/cli link`). Nunca al proyecto padre.

## Variables de entorno

La lista completa y comentada está en [`.env.example`](.env.example). Cada línea indica dónde se usa:

- `[Prod+Preview]`: se configura en ambos entornos de Vercel.
- `[Preview]`: solo en Preview o en desarrollo local. En Production no debe estar definida o debe tener el valor seguro.
- `[Local]`: solo para scripts, tests y mocks.

Los secretos (`INSFORGE_API_KEY`, tokens de Mercado Pago, `CRON_SECRET`, claves de sesión del admin) no se commitean ni se exponen con prefijos públicos.

## Entornos y ramas

| Rama git | Backend InsForge | Entorno Vercel |
| --- | --- | --- |
| `main` | proyecto padre `Citadely` (producción) | Production (`citadely.com.ar`, canónico `www`) |
| `lead-development` | rama de integración: recibe los PR de trabajo antes de `main` | Preview |
| `feat/*`, `fix/*`, `chore/*` | backend branch con el mismo nombre | Preview del PR |

Reglas:

- Una rama git corresponde a **un** backend branch de InsForge con el mismo nombre. Las migraciones se prueban ahí antes de llegar al padre.
- Los cambios de base se aplican al padre solo en el release, siguiendo [`docs/release-checklist.md`](docs/release-checklist.md).
- Convención de nombres: `feat/<tema>`, `fix/<tema>`, `chore/<tema>`.

### Protección de `main` (configuración manual en GitHub)

Settings → Branches → regla para `main`:

1. Require a pull request before merging.
2. Require status checks to pass: el job **`checks`** de [`ci.yml`](.github/workflows/ci.yml) (y el job `e2e` si el repositorio usa `E2E_ENABLED`).
3. Require branches to be up to date before merging.
4. Do not allow bypassing the above settings.

Detalle de CI y secretos en [`docs/ci.md`](docs/ci.md).

## Scripts

| Script | Qué hace |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Desarrollo, build de producción y servidor de producción |
| `pnpm lint` / `pnpm typecheck` | ESLint y `tsc --noEmit` |
| `pnpm schema:diff` | Compara el esquema de dos proyectos InsForge (ver `docs/release-checklist.md`) |
| `pnpm seed:demo`, `pnpm seed:barberia-luk`, `pnpm seed:clinica-colon` | Cargan datos de prueba |
| `pnpm test:e2e` | Playwright contra un backend branch |
| `pnpm smoke:resend` | Envía un email real de reserva para verificar Resend |
| `pnpm email:dev` / `pnpm email:export` | Vista previa y export de las plantillas de email |

### Seeds y E2E escriben datos

Los seeds y el E2E **solo** escriben en un backend branch. Antes de escribir:

- Verifican que el proyecto tenga `branched_from` (`.insforge/project.json` en los seeds; `E2E_INSFORGE_BRANCHED_FROM` en los E2E, que el config deriva de ese archivo si no está definida) y, en los E2E, que la app apunte al mismo backend; si no, se niegan a correr.
- Muestran el nombre del proyecto. Si la sesión es interactiva, hay que escribirlo para confirmar. Si no lo es (CI, Playwright, pipes), hay que definirlo en el entorno:

```bash
SEED_CONFIRM_PROJECT=feature-functionalities-improves pnpm test:e2e
SEED_CONFIRM_PROJECT=feature-functionalities-improves pnpm seed:demo
```

El nombre tiene que ser exactamente el `project_name` del backend branch enlazado.

Los scripts de `scripts/archive/` son históricos y no se ejecutan.

## Crons

Vercel Hobby solo permite crons diarios, así que los crons se reparten en dos lugares. Todas las rutas `/api/cron/*` aceptan GET y POST y exigen `Authorization: Bearer $CRON_SECRET`.

**Vercel Cron** (declarado en [`vercel.ts`](vercel.ts), solo corre en producción):

- `/api/cron/reconcile-subscriptions`: diario a las 06:00 UTC. Re-sincroniza suscripciones y detecta huérfanas.

**Schedules de InsForge** (`POST` contra `https://www.citadely.com.ar/api/cron/<ruta>` con el header `Authorization: Bearer ${{secrets.CRON_SECRET}}`; el secreto `CRON_SECRET` tiene que existir en el proyecto de InsForge):

| Nombre | Ruta | Frecuencia | Qué hace |
|---|---|---|---|
| `Citadely transactional email` | `/api/cron/transactional-email` | cada minuto (`* * * * *`) | Envía la cola de emails (`email_outbox`). |
| `Citadely cancel expired deposits` | `/api/cron/cancel-expired-deposits` | cada 10 minutos (`*/10 * * * *`) | Cancela reservas con seña vencida. |
| `Citadely failure alerts` | `/api/cron/failure-alerts` | cada 15 minutos (`*/15 * * * *`) | Registra fallas de email y de webhooks. |

El schedule `Citadely transactional email` (id `6cc3b1f4`) ya existe en el proyecto padre (producción) y responde 200 cada minuto; la copia heredada que había en el backend branch se borró el 2026-10-16. En el release solo hay que crear los otros dos (una sola vez, en el padre):

```bash
npx -y @insforge/cli schedules create \
  --name "Citadely cancel expired deposits" \
  --cron "*/10 * * * *" \
  --url "https://www.citadely.com.ar/api/cron/cancel-expired-deposits" \
  --method POST \
  --headers '{"Authorization": "Bearer ${{secrets.CRON_SECRET}}"}'

npx -y @insforge/cli schedules create \
  --name "Citadely failure alerts" \
  --cron "*/15 * * * *" \
  --url "https://www.citadely.com.ar/api/cron/failure-alerts" \
  --method POST \
  --headers '{"Authorization": "Bearer ${{secrets.CRON_SECRET}}"}'
```

Verificación: `npx -y @insforge/cli schedules list` muestra los tres activos y `schedules logs <id>` devuelve ejecuciones con 200. No dupliques estos tres en `vercel.ts` mientras el proyecto esté en Hobby. Si se pasa a Pro, se pueden mover a `vercel.ts` y borrar los schedules de InsForge, siempre en ese orden.

## Tests

- `pnpm test:e2e` usa Playwright. El E2E corre contra `next dev` en el puerto 3002 y un mock de Mercado Pago. Requiere las variables de `[Local]` y `SEED_CONFIRM_PROJECT`.
- Política de tests unitarios y de RLS: ver los tickets de la fase 7 del plan.

## Seguridad y anti-abuso

Límites de reservas, rate limit y decisiones de seguridad están en [`docs/anti-abuse.md`](docs/anti-abuse.md).

## Archivos del repositorio que no son código de la app

- `agent/`: skills de agentes de IA para este proyecto. Se versionan para que todas las sesiones usen las mismas reglas. Se excluyen del deploy (`.vercelignore`).
- `skills-lock.json`: versiones fijadas de esas skills. Se versiona junto a `agent/`.
- `opencode.json`: configuración del cliente de agentes OpenCode, con los MCP que usa el proyecto. Se versiona para que el equipo comparta la misma configuración. No contiene secretos.
- `.impeccable/`: artefactos de revisión de diseño (PNG). No se versionan y están en `.gitignore`.

## Deploy

Push a `main` (vía PR) despliega Production; las ramas despliegan Preview. Antes de promover a Production, aplicar las migraciones al padre y correr el checklist de [`docs/release-checklist.md`](docs/release-checklist.md).

Dominio: el apex `citadely.com.ar` redirige con 308 a `https://www.citadely.com.ar`, que es el host canónico. Los subdominios `<negocio>.citadely.com.ar` son las páginas públicas en producción; fuera de producción se usa `/b/<slug>`.
