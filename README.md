# Al9ani (القاني)

Al9ani is a Tunisian platform for discovering and booking local businesses and activities:
beauty salons, hair and barber shops, Pilates and yoga studios, gyms, padel and tennis courts,
and other sports or leisure experiences. Customers will find trusted places, see services and
availability, and reserve without back-and-forth messaging. Owners will get a clear schedule
and the tools to welcome more customers.

> **Current status: Phase 4A — Establishment and service management.**
> The monorepo, PostgreSQL environment, Prisma schema and migrations, authentication, owner
> establishment/service management, administrator moderation, and public discovery are
> implemented and verified. The reservation engine, billing, dashboards, and the Flutter client
> are not implemented yet. Phase 4A deliberately stops before reservations and availability.

## Business model

This section separates the intended product model from what the code currently implements.

### Planned model

- **Customers use Al9ani for free.**
- **Establishments pay 69 TND per month per establishment.**
- **No booking commission** is planned for the initial model.
- **Online payments are not required for the MVP.** The subscription can be tracked without a
  payment-provider integration at first.

### Implemented today

- The `Subscription` database model exists with a default price of `69.000 TND`, monthly billing,
  and lifecycle fields.
- There is **no billing integration, subscription API, or subscription-gated discovery** yet.
- Public discovery is based on establishment approval status and an active owner, not on a
  subscription.
- No customer payment flow exists.

## Technology stack

Versions are taken from the workspace `package.json` files and `docker-compose.yml`.

| Layer                | Technology                                  | Version / detail                      |
| -------------------- | ------------------------------------------- | ------------------------------------- |
| Runtime              | Node.js                                     | `>=22.12.0` (verified on 22.19.0)     |
| Package manager      | npm workspaces                              | `>=10.0.0` (verified on 11.14.0)      |
| Backend              | NestJS + TypeScript                         | NestJS `12.3.3`, TypeScript `6.0.3`   |
| API documentation    | Swagger / OpenAPI                           | `@nestjs/swagger` `12.1.0`            |
| Frontend             | Next.js (App Router) + React                | Next `16.4.5`, React `19.3.1`         |
| Database             | PostgreSQL in Docker                        | `postgres:17.11-alpine`               |
| ORM                  | Prisma + PostgreSQL driver adapter          | Prisma `7.10.1`, `@prisma/adapter-pg` |
| Authentication       | Argon2id, JWT access tokens, opaque refresh | `argon2` `0.45.2`, `@nestjs/jwt`      |
| Validation           | `class-validator` / `class-transformer`     | `0.15.1` / `0.5.1`                    |
| Rate limiting        | `@nestjs/throttler`                         | `6.7.1`                               |
| Testing              | Node test runner, Nest testing, Supertest   | 21 integration tests                  |
| Containers           | Docker Compose                              | Compose v2 (verified on v2.39.4)      |
| Formatting / linting | Prettier `3.9.10`, ESLint `10.14.0`         | Both workspaces                       |

## Repository structure

```text
al9ani/
├── apps/
│   ├── api/                       NestJS API
│   │   ├── prisma/
│   │   │   ├── schema.prisma      Data model
│   │   │   └── migrations/        Three committed additive migrations
│   │   ├── prisma.config.ts       Prisma CLI configuration and connection URL
│   │   ├── scripts/
│   │   │   ├── create-admin.ts    Controlled administrator provisioning
│   │   │   └── seed-categories.ts Repeatable development category seed
│   │   ├── test/
│   │   │   ├── auth.e2e.test.ts
│   │   │   └── establishments.e2e.test.ts
│   │   └── src/
│   │       ├── admin/             Admin-only authorization test route
│   │       ├── auth/              Registration, login, refresh, guards, DTOs
│   │       ├── business-hours/    Recurring local opening intervals
│   │       ├── categories/        Admin category lifecycle and public listing
│   │       ├── common/            Filters, pagination, transformers, validators
│   │       ├── config/            Typed environment configuration
│   │       ├── database/          PrismaService and DatabaseModule
│   │       ├── establishments/    Owner, moderation, and public establishment APIs
│   │       ├── generated/         Generated Prisma Client (ignored by Git)
│   │       ├── health/            Liveness and database readiness
│   │       ├── services/          Owner and public service APIs
│   │       ├── unavailable-periods/ Establishment-wide and service closures
│   │       ├── app.module.ts      Root module and global providers
│   │       ├── app.setup.ts       Shared HTTP setup for main and tests
│   │       └── main.ts            Bootstrap
│   └── web/                       Next.js (App Router) web application
│       └── app/                   Landing page, layout, global styles, icon
├── docker/                        Docker and PostgreSQL notes
├── docs/                          Phase design and implementation notes
├── docker-compose.yml             PostgreSQL service and persistent volume
├── package.json                   npm workspaces and root scripts
├── package-lock.json              Reproducible dependency lockfile
├── .env.example                   Safe environment template (no real secrets)
└── .gitignore                     Excludes secrets, dependencies, and build output
```

The API and web application run on the host during development. Only PostgreSQL is containerized.

## Completed phases

The work below is implemented and was verified on the local development environment. Later
sections mark clearly what is only planned.

### Phase 1 — Foundation

- npm workspace monorepo with shared root scripts and Prettier configuration.
- NestJS API and Next.js web application.
- PostgreSQL 17.11 running through Docker Compose with a health check and a persistent named
  volume (`al9ani-postgres-data`).
- Public liveness endpoint at `/api/health` and database readiness at `/api/health/database`.
- Swagger/OpenAPI enabled outside production.
- Typed environment configuration derived from the root `.env`.

### Phase 2 — Database

- Prisma schema covering `User`, `RefreshSession`, `Establishment`, `Category`,
  `EstablishmentCategory`, `Service`, `BusinessHours`, `UnavailablePeriod`, `Reservation`,
  `Favorite`, and `Subscription`.
- Three committed migrations:
  - `20261105215652_init`
  - `20261105222004_auth_sessions`
  - `20261106151057_establishment_management`
- UUID primary keys and `timestamptz(3)` timestamps.
- Money stored as `DECIMAL(10,3)` with a currency code; TND has three decimal places.
- Database checks for coordinate ranges, positive service duration/capacity, price ranges,
  business-hour minute ranges, reservation time ranges, and subscription periods.
- Indexes supporting role, status/city, service, unavailability, reservation conflict, favorite,
  subscription, and refresh-session queries.
- **The `Reservation` model and its indexes exist, but reservation conflict enforcement is not
  implemented.** Conflict and capacity checks are future transactional application logic.

### Phase 3 — Authentication

- Customer and owner registration. Public administrator registration is rejected.
- Login, logout, refresh-token rotation, and `GET /api/auth/me`.
- Argon2id password hashing.
- Short-lived JWT access tokens (15 minutes by default) and opaque refresh tokens stored only as
  SHA-256 hashes.
- Refresh-session families with replay detection: reusing a rotated or revoked token revokes the
  family.
- Web refresh tokens use an `HttpOnly`, `SameSite=Lax` cookie scoped to `/api/auth`; mobile clients
  receive the refresh token in JSON.
- Global JWT and role guards, reusable `@Public()` and `@Roles()` decorators, and protected
  administrator routes.
- Per-route and global rate limiting, global DTO whitelisting, and consistent error responses.
- Controlled administrator provisioning through `npm run create-admin`; no public admin signup.

Known authentication limitations are listed in [Current limitations](#current-limitations).

### Phase 4A — Establishment and service management

- Owner establishment creation in `DRAFT`, listing, reading, editing, category assignment, and
  submission for approval.
- Administrator establishment inspection, approval, rejection with a reason, and suspension with
  a reason.
- Administrator category creation, listing, editing, activation, and deactivation. Public listing
  exposes active categories only.
- Owner service CRUD and deactivation with booking-type, duration, capacity, price, currency, and
  ownership validation.
- Public discovery of `ACTIVE` establishments with an active owner, and active services belonging
  to those establishments.
- Business-hours management with split intervals, local minute ranges, same-weekday overlap
  validation, and the establishment's IANA time zone.
- Establishment-wide and service-specific unavailable periods with ownership and range validation.
- Ownership always comes from the authenticated token; another owner's resource and a missing
  resource both return `404`.
- Public responses omit owner identity, moderation status, and rejection/suspension reasons.
- Repeatable category seed script.
- Integration tests covering authentication, ownership isolation, moderation, public visibility,
  categories, services, business hours, unavailable periods, and error consistency.

### Verified results

| Check                                      | Result                                  |
| ------------------------------------------ | --------------------------------------- |
| `npm test`                                 | **21/21 passed** (12 auth, 9 Phase 4A)  |
| Live endpoint checks against the built API | **25/25 passed**                        |
| `npm run build` (API + web)                | passed                                  |
| `npm run lint` (API + web)                 | passed                                  |
| `npm run format:check`                     | passed                                  |
| `npm run prisma:validate`                  | passed                                  |
| `npm run prisma:status`                    | passed, 3 migrations, schema up to date |
| Category seed executed twice               | passed, idempotent                      |

Live checks exercised health, database readiness, Swagger, administrator provisioning, category
management, establishment creation and submission, moderation, public filtering, service
eligibility, and suspension. Temporary verification rows were removed afterwards.

## Current API endpoints

All application routes use the `/api` prefix. Endpoints below are the routes that actually exist
in the current controllers.

### Health

| Method | Endpoint               | Access | Purpose                                          |
| ------ | ---------------------- | ------ | ------------------------------------------------ |
| GET    | `/api/health`          | Public | Liveness; does not touch the database            |
| GET    | `/api/health/database` | Public | Database readiness; returns `503` if unreachable |

### Authentication

| Method | Endpoint             | Access        | Purpose                                             |
| ------ | -------------------- | ------------- | --------------------------------------------------- |
| POST   | `/api/auth/register` | Public        | Register a `CUSTOMER` or `OWNER`                    |
| POST   | `/api/auth/login`    | Public        | Authenticate and issue access/refresh tokens        |
| POST   | `/api/auth/refresh`  | Public        | Rotate a refresh token and issue a new access token |
| POST   | `/api/auth/logout`   | Public        | Revoke the refresh-session family                   |
| GET    | `/api/auth/me`       | Authenticated | Return the caller's safe profile                    |

### Public discovery

| Method | Endpoint                           | Purpose                                                      |
| ------ | ---------------------------------- | ------------------------------------------------------------ |
| GET    | `/api/categories`                  | Paginated active categories                                  |
| GET    | `/api/public/establishments`       | Paginated approved, active, publicly eligible establishments |
| GET    | `/api/public/establishments/:slug` | One approved establishment by public slug                    |
| GET    | `/api/public/services`             | Paginated active services of eligible establishments         |
| GET    | `/api/public/services/:id`         | One publicly eligible service                                |

Supported filters:

- Establishments: `q`, `city`, `category` (category slug), `page`, `limit`.
- Services: `q`, `city`, `category`, `establishmentId`, `establishmentSlug`, `page`, `limit`.

### Owner (`OWNER` role)

| Method | Endpoint                                                              | Purpose                                        |
| ------ | --------------------------------------------------------------------- | ---------------------------------------------- |
| POST   | `/api/establishments`                                                 | Create a draft establishment                   |
| GET    | `/api/establishments`                                                 | List the authenticated owner's establishments  |
| GET    | `/api/establishments/:id`                                             | View an owned establishment                    |
| PATCH  | `/api/establishments/:id`                                             | Update details without changing status         |
| PUT    | `/api/establishments/:id/categories`                                  | Replace the category assignment                |
| POST   | `/api/establishments/:id/submit`                                      | Submit for administrator approval              |
| GET    | `/api/establishments/:id/status`                                      | View approval status and reason                |
| POST   | `/api/establishments/:establishmentId/services`                       | Create a service                               |
| GET    | `/api/establishments/:establishmentId/services`                       | List services of an owned establishment        |
| GET    | `/api/establishments/:establishmentId/services/:serviceId`            | View one service                               |
| PATCH  | `/api/establishments/:establishmentId/services/:serviceId`            | Update one service                             |
| POST   | `/api/establishments/:establishmentId/services/:serviceId/deactivate` | Deactivate a service                           |
| GET    | `/api/establishments/:establishmentId/business-hours`                 | List intervals and the establishment time zone |
| POST   | `/api/establishments/:establishmentId/business-hours`                 | Create one opening interval                    |
| PATCH  | `/api/establishments/:establishmentId/business-hours/:hoursId`        | Update one opening interval                    |
| DELETE | `/api/establishments/:establishmentId/business-hours/:hoursId`        | Delete one opening interval                    |
| GET    | `/api/establishments/:establishmentId/unavailable-periods`            | List closures                                  |
| POST   | `/api/establishments/:establishmentId/unavailable-periods`            | Create a closure                               |
| PATCH  | `/api/establishments/:establishmentId/unavailable-periods/:periodId`  | Update a closure                               |
| DELETE | `/api/establishments/:establishmentId/unavailable-periods/:periodId`  | Delete a closure                               |

### Administrator (`ADMIN` role)

| Method | Endpoint                                | Purpose                                 |
| ------ | --------------------------------------- | --------------------------------------- |
| GET    | `/api/admin/ping`                       | Protected authorization test route      |
| POST   | `/api/admin/categories`                 | Create a category                       |
| GET    | `/api/admin/categories`                 | List all categories, including inactive |
| PATCH  | `/api/admin/categories/:id`             | Update a category                       |
| POST   | `/api/admin/categories/:id/activate`    | Activate a category                     |
| POST   | `/api/admin/categories/:id/deactivate`  | Deactivate without deleting links       |
| GET    | `/api/admin/establishments`             | Inspect all establishments              |
| GET    | `/api/admin/establishments/:id`         | Inspect one establishment and its owner |
| POST   | `/api/admin/establishments/:id/approve` | Approve a pending establishment         |
| POST   | `/api/admin/establishments/:id/reject`  | Reject pending with a required reason   |
| POST   | `/api/admin/establishments/:id/suspend` | Suspend active with a required reason   |

### Shared API behavior

- Collection endpoints are paginated with `page` (default `1`) and `limit` (default `20`, maximum
  `100`) and return `{ data, meta: { page, limit, total, totalPages } }`.
- Errors keep the shared shape:
  `{ statusCode, error, message, path, timestamp }`.
- `400` validation failure, `401` missing/invalid token, `403` wrong role, `404` missing or
  inaccessible resource, `409` duplicate or invalid lifecycle transition.
- Swagger UI is available at `/docs` and the OpenAPI JSON at `/docs-json` whenever
  `NODE_ENV` is neither `production` nor `test`.

## Local development setup (Windows + PowerShell + Docker Desktop)

### Prerequisites

- **Node.js 22.12 or newer** and **npm 10 or newer**. The project was verified on Node `22.19.0`
  and npm `11.14.0`. NestJS 12 tooling recommends Node `22.22.3+`; Node 22.19 works but may print
  `EBADENGINE` warnings.
- **Git**.
- **Docker Desktop** with Docker Compose v2 and Linux containers enabled.
- PowerShell at the repository root.

Check the tools:

```powershell
node --version
npm --version
git --version
docker --version
docker compose version
```

### 1. Clone and install

```powershell
git clone https://github.com/semahmay/AL9ANI.git
cd AL9ANI
npm install
```

`npm install` installs both workspaces (`apps/api` and `apps/web`) and uses the committed root
`package-lock.json`.

### 2. Create the local environment file

```powershell
Copy-Item .env.example .env
```

Open `.env` and set at least:

- `POSTGRES_PASSWORD` — a strong local password.
- `JWT_ACCESS_SECRET` — a unique random value of at least 32 characters.

Generate a secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

**Important local port note:** the reference development environment uses **`127.0.0.1:5433`**
for Al9ani because port `5432` is occupied by an unrelated local PostgreSQL container. Set:

```dotenv
POSTGRES_PORT=5433
```

Do not stop or modify the unrelated container. On a different machine, use `5432` if it is free.
The PostgreSQL container always listens on `5432` internally; `POSTGRES_PORT` is only the host
binding.

Never commit `.env`. The repository ignores `.env` and every `.env.*` file except
`.env.example`.

### 3. Start PostgreSQL

```powershell
npm run db:up
npm run db:status
```

Wait for the `al9ani-postgres` container to become `healthy`. Data is stored in the named volume
`al9ani-postgres-data`.

### 4. Generate Prisma Client and apply migrations

```powershell
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:status
```

`prisma:migrate:deploy` applies only pending committed migrations. It does not reset or delete
data. `prisma:status` should report **3 migrations found** and **Database schema is up to date**.

The generated client lives in `apps/api/src/generated/prisma` and is ignored by Git, so it must be
generated after a fresh clone. `npm run build` also generates it automatically.

### 5. Seed development categories (optional)

The seed is repeatable and upserts by slug:

```powershell
npm run seed:categories --workspace @al9ani/api
```

It creates or updates the six development discovery categories. It does not create fake
establishments, users, or reservations, and it does not reactivate categories an administrator
has deactivated.

### 6. Start the applications

Run each command in its own PowerShell terminal from the repository root:

```powershell
# Terminal 1 — NestJS API in watch mode
npm run dev:api

# Terminal 2 — Next.js web application
npm run dev:web
```

### 7. Local URLs

| Service            | URL                                         |
| ------------------ | ------------------------------------------- |
| Web application    | <http://localhost:3000>                     |
| API liveness       | <http://localhost:3001/api/health>          |
| Database readiness | <http://localhost:3001/api/health/database> |
| Swagger UI         | <http://localhost:3001/docs>                |
| OpenAPI JSON       | <http://localhost:3001/docs-json>           |
| PostgreSQL (host)  | `127.0.0.1:5433` on this machine            |

`/api/health` does not touch the database. `/api/health/database` runs `SELECT 1` and returns
`503` when PostgreSQL is unreachable. Swagger is disabled when `NODE_ENV=production`.

### 8. Run the quality checks

```powershell
npm test
npm run lint
npm run format:check
npm run build
npm run prisma:validate
npm run prisma:status
```

`npm test` compiles the test build with `tsc` and runs both integration suites against the real
Nest application and the configured PostgreSQL database. The tests remove every prefix-named
user, establishment, category, and cascaded child row they create, but they still use the
configured database. See [Database and migration safety](#database-and-migration-safety).

### 9. Provision a local administrator (optional)

Administrators cannot register publicly. Use the controlled CLI with temporary environment
variables:

```powershell
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "replace-with-a-long-random-password"
$env:ADMIN_FIRST_NAME = "Al9ani"
$env:ADMIN_LAST_NAME = "Admin"
npm run create-admin
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:ADMIN_FIRST_NAME, Env:ADMIN_LAST_NAME
```

The command creates or promotes the account without printing the password. Do not put these
values in `.env` or commit them.

## Database and migration safety

The local database may contain work that matters. Treat it as potentially valuable even if a
previous test run left the Phase 4A tables empty.

Safe inspection and application:

```powershell
# Show which migrations are recorded and whether the schema is current
npm run prisma:status

# Apply only pending committed migrations
npm run prisma:migrate:deploy

# Validate the schema without touching data
npm run prisma:validate
```

Rules for everyone on the project:

- **Never run `prisma migrate reset` against a database containing valuable data.** It drops and
  recreates the schema.
- **Never delete the Docker volume `al9ani-postgres-data`.** Removing the container with
  `docker compose down` keeps the data; `docker compose down -v` deletes the volume.
- Do not rewrite, squash, or delete existing migrations after they have been applied. Add a new
  migration instead.
- Run integration tests only against a disposable local/test database. The current test command
  uses the database configured in `.env`, so confirm that is acceptable before running it.
- Do not run destructive cleanup commands to "fix" a migration state. Inspect `prisma:status`,
  the migration folder, and the database first.

All three migrations in `apps/api/prisma/migrations` are additive or create new objects. The
Phase 4A migration adds enum values, `Category.isActive`, and `Establishment.statusReason` without
dropping or rewriting existing data.

## Current limitations

Verified against the current source code:

- **No reservation engine.** The `Reservation` model exists, but there are no reservation
  controllers, services, or endpoints.
- **No availability generation and no double-booking prevention.** Reservation conflict and
  capacity enforcement inside transactions is not implemented.
- **No customer favorites API.** The `Favorite` model exists, but no route uses it.
- **No subscription billing or lifecycle API.** The `Subscription` model and 69 TND default exist,
  but there is no payment integration, renewal job, or subscription-gated discovery.
- **No owner or administrator dashboards.** The web application is a landing page.
- **No Flutter client.** Flutter is outside the current scope.
- **No email verification, password reset, MFA, or account recovery.**
- **No session listing or management UI.** Refresh sessions are stored but not exposed.
- **Active establishments can be edited without re-approval.** A future moderation policy may
  require sensitive edits to return a listing to `PENDING`.
- **No suspended-establishment reinstatement endpoint.** Approval intentionally accepts only
  `PENDING`.
- **No archived transition endpoint.** `ARCHIVED` exists in the enum but has no API transition.
- **Business hours do not support overnight/cross-midnight intervals.** The model stores
  same-weekday local minutes from `0` to `1440`.
- **No service reactivation endpoint.** Owners can deactivate a service but not reactivate it.
- **No category deletion.** Deactivation preserves historical establishment links.
- **Business-hour overlap is application-level only.** Concurrent writes could still create
  overlaps because there is no PostgreSQL exclusion constraint.
- **No overlap rule for unavailable periods.** Layered closures are allowed; only range and
  ownership validation apply.
- **Currency is format-validated, not checked against a full ISO 4217 registry.**
- **Public search is substring-based.** No geospatial radius, ranking, or full-text index.
- **No owner/administrator audit trail.** `statusReason` records why, but not who performed the
  action.
- **Authentication limitations:** access tokens remain valid until expiry after logout (at most
  15 minutes); role changes and account deactivation affect protected routes when the next access
  token is issued (at most 15 minutes); rate limiting is in-memory and per instance; expired
  refresh sessions are not proactively deleted.
- **No production deployment, monitoring, or backup automation.**

## Next steps for the teammate

This is a **proposed roadmap**, not completed work. Do not assume any item below exists until it
is implemented and tested.

1. **Review and run the project.** Follow the setup above, run the 21 tests and all quality
   checks, and confirm the API and web app start locally.
2. **Review the API, schema, and documentation.** Read this README, the phase documents in
   `docs/`, the Prisma schema, and the current controllers before changing anything.
3. **Design and implement the reservation engine.**
   - Define appointment, class, and resource booking semantics.
   - Calculate availability from business hours, the establishment time zone, and unavailable
     periods.
   - Prevent conflicts and enforce capacity inside a transaction, including concurrent booking
     tests.
   - Add customer reservation listing and cancellation.
   - Add owner reservation management.
4. **Implement favorites** if the product still needs them.
5. **Implement subscription lifecycle and access rules**, including the 69 TND/month model and
   any discovery gating.
6. **Add owner and administrator web dashboards.**
7. **Build the Flutter customer application** later, against the documented API.
8. **Add production-readiness work:** email verification, password recovery, monitoring, backups,
   deployment, and a shared rate-limit store.

Recommended order: finish the reservation engine and its concurrency tests before building
dashboards or the mobile client, because both depend on stable booking semantics.

## Current Git status

- **Branch:** `main`
- **Remote:** <https://github.com/semahmay/AL9ANI.git>
- **Initial Phase 4A publication:** this README is committed with the Phase 4A foundation.
- **Latest commit:** run `git log -1 --oneline` (the hash is intentionally not hard-coded here so
  this section cannot become stale).

## Documentation index

- [`docs/phase-1-foundation.md`](docs/phase-1-foundation.md) — monorepo, API shell, Docker, health.
- [`docs/phase-2-database.md`](docs/phase-2-database.md) — data model and migration decisions.
- [`docs/phase-3-authentication.md`](docs/phase-3-authentication.md) — auth design and trade-offs.
- [`docs/phase-4a-establishment-management.md`](docs/phase-4a-establishment-management.md) —
  endpoints, validation, approval workflow, and open decisions.
- [`docker/README.md`](docker/README.md) — PostgreSQL container notes.

## Environment variables

All values live in the root `.env` file. See `.env.example` for the safe template. Never commit
real values.

| Variable                   | Used by      | Purpose                                       | Default                     |
| -------------------------- | ------------ | --------------------------------------------- | --------------------------- |
| `NODE_ENV`                 | API          | Runtime mode; Swagger is off in production    | `development`               |
| `API_PORT`                 | API          | API listening port                            | `3001`                      |
| `APP_NAME`                 | API          | Service name returned by the health endpoint  | `Al9ani API`                |
| `CORS_ORIGIN`              | API          | Comma-separated allowed browser origins       | `http://localhost:3000`     |
| `NEXT_PUBLIC_API_URL`      | Web          | Public API base URL for future client calls   | `http://localhost:3001/api` |
| `POSTGRES_USER`            | Docker / API | PostgreSQL user                               | required                    |
| `POSTGRES_PASSWORD`        | Docker / API | PostgreSQL password                           | required                    |
| `POSTGRES_DB`              | Docker / API | PostgreSQL database name                      | required                    |
| `POSTGRES_PORT`            | Docker / API | Host port bound to `127.0.0.1`                | `5432` (use `5433` locally) |
| `POSTGRES_HOST`            | API          | Database host used by Prisma                  | `127.0.0.1`                 |
| `DATABASE_URL`             | API          | Optional full connection-string override      | derived from `POSTGRES_*`   |
| `JWT_ACCESS_SECRET`        | API          | HS256 access-token signing secret (32+ chars) | required                    |
| `JWT_ACCESS_TTL_SECONDS`   | API          | Access-token lifetime                         | `900` (15 minutes)          |
| `JWT_REFRESH_TTL_SECONDS`  | API          | Refresh-session lifetime                      | `2592000` (30 days)         |
| `AUTH_COOKIE_NAME`         | API          | HttpOnly refresh-cookie name                  | `al9ani_refresh`            |
| `AUTH_COOKIE_SECURE`       | API          | Force `Secure` refresh cookies                | `true` in production        |
| `AUTH_COOKIE_SAME_SITE`    | API          | `lax`, `strict`, or `none`                    | `lax`                       |
| `AUTH_RATE_LIMIT_LIMIT`    | API          | Global requests allowed per window            | `100`                       |
| `AUTH_RATE_LIMIT_TTL_MS`   | API          | Global rate-limit window in milliseconds      | `60000`                     |
| `AUTH_RATE_LIMIT_DISABLED` | API          | Disable throttling (automated tests only)     | `false`                     |

Prisma does not need a second copy of the credentials. When `DATABASE_URL` is unset, both the API
and the Prisma CLI build it from `POSTGRES_*` with URL-encoded credentials.

## Scripts

| Command                                           | Description                                        |
| ------------------------------------------------- | -------------------------------------------------- |
| `npm run dev:api`                                 | Start the API in watch mode                        |
| `npm run dev:web`                                 | Start the Next.js development server               |
| `npm run build`                                   | Build both applications                            |
| `npm run lint`                                    | Lint both applications                             |
| `npm run lint:fix`                                | Lint and auto-fix both applications                |
| `npm run format`                                  | Format the repository with Prettier                |
| `npm run format:check`                            | Check formatting without changing files            |
| `npm run db:up`                                   | Start PostgreSQL in the background                 |
| `npm run db:down`                                 | Stop the PostgreSQL container (keeps the volume)   |
| `npm run db:logs`                                 | Follow PostgreSQL logs                             |
| `npm run db:status`                               | Show container status and health                   |
| `npm run prisma:generate`                         | Generate the Prisma Client                         |
| `npm run prisma:validate`                         | Validate `schema.prisma`                           |
| `npm run prisma:migrate`                          | Create and apply a migration in development        |
| `npm run prisma:migrate:create`                   | Create a migration without applying it             |
| `npm run prisma:migrate:deploy`                   | Apply pending committed migrations                 |
| `npm run prisma:status`                           | Show migration status                              |
| `npm run prisma:studio`                           | Open Prisma Studio for local browsing              |
| `npm test`                                        | Run both integration test suites                   |
| `npm run create-admin`                            | Provision an administrator from `ADMIN_*` env vars |
| `npm run seed:categories --workspace @al9ani/api` | Add or update the development categories           |

## Security notes

- `.env` and all `.env.*` files are ignored except `.env.example`.
- Passwords are hashed with Argon2id; refresh tokens are stored only as SHA-256 hashes.
- Passwords, plaintext tokens, and password hashes are never logged or returned by the API.
- Access tokens are short-lived HS256 JWTs and are never stored in cookies. Web refresh tokens
  use `HttpOnly`, `SameSite=Lax`, and production `Secure` cookies.
- Refresh tokens rotate on every use; replay revokes the whole session family.
- Validation whitelists DTO fields and rejects unknown properties, preventing mass assignment of
  `status`, `statusReason`, `ownerId`, and review fields.
- Public discovery filters on approved status, active owner, active services, and active
  categories; owner identity and moderation reasons are not exposed.
- PostgreSQL is bound to `127.0.0.1` only.
- The database URL is derived at runtime from `POSTGRES_*`; credentials are never committed.
- The generated Prisma Client is ignored by Git and regenerated from the committed schema.
- Never commit real credentials, tokens, or production connection strings.

## Troubleshooting

**Docker is not running**

Start Docker Desktop, wait for the engine to report ready, then run `npm run db:up`. On Windows,
confirm Docker Desktop is using Linux containers.

**PostgreSQL container is unhealthy**

Inspect `npm run db:logs`. Confirm `.env` exists at the repository root and `POSTGRES_PASSWORD`
is set.

**Port 5432 is already in use**

This machine already runs an unrelated PostgreSQL container on `5432`. Set `POSTGRES_PORT=5433`
in `.env`, then run `npm run db:up` again. Do not stop the unrelated container.

**Port 3000 or 3001 is already in use**

Change `API_PORT` in `.env` for the API. For the web app:
`npm run dev --workspace @al9ani/web -- --port 3002`.

**Prisma reports a missing generated client**

Run `npm run prisma:generate`, then restart the API.

**Migration status looks wrong**

Run `npm run prisma:status` and inspect `apps/api/prisma/migrations`. Do not reset the database or
delete the volume. Ask for a review before taking corrective action.
