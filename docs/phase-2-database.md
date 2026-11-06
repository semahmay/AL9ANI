# Phase 2 — Prisma and initial data model

## Goal

Introduce Prisma without changing the Phase 1 architecture, define the initial relational
model for Al9ani, and apply a safe first migration to the local PostgreSQL database.

## Versions

| Component            | Version | Notes                                            |
| -------------------- | ------- | ------------------------------------------------ |
| Prisma CLI / Client  | 7.10.1  | Stable; supports Node `^22.12` and PostgreSQL 17 |
| `@prisma/adapter-pg` | 7.10.1  | Uses `pg` 8 for the runtime connection           |
| Node.js              | 22.19.0 | Meets Prisma 7 requirements                      |
| PostgreSQL           | 17.11   | Existing Docker container on host port 5433      |

Prisma 8 is still a release candidate, so the project intentionally stays on 7.10.1.

## Configuration

- `apps/api/prisma.config.ts` loads the optional `apps/api/.env` and then the root `.env`.
- The connection URL comes from `DATABASE_URL` when set, otherwise it is built from
  `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST`, and `POSTGRES_PORT`.
- Credentials are URL-encoded and never printed. `POSTGRES_PORT=5433` is preserved.
- `PrismaService` uses `@prisma/adapter-pg` and connects lazily on the first query, so the
  API can start even when PostgreSQL is temporarily down.
- `/api/health` remains database-independent. `/api/health/database` performs `SELECT 1` and
  returns `503` if the database is unavailable.

## Data model

```text
User 1 ── * Establishment 1 ── * Service 1 ── * Reservation * ── 1 User
                    │                │
                    ├── * EstablishmentCategory * ── 1 Category
                    ├── * BusinessHours
                    ├── * UnavailablePeriod (optionally tied to a Service)
                    ├── * Favorite * ── 1 User
                    └── 1 Subscription
```

### User

- Roles: `CUSTOMER`, `OWNER`, `ADMIN`. The MVP stores one role per user.
- An owner can own many establishments through `Establishment.ownerId`.
- Authentication fields (`passwordHash` and refresh sessions) were added in Phase 3. See
  [`phase-3-authentication.md`](phase-3-authentication.md).

### Establishment

- UUID primary key, unique slug, owner relation, status, contact and address fields.
- `timezone` defaults to `Africa/Tunis` and is used to interpret local business hours.
- Original statuses were `DRAFT`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`. Phase 4A added `PENDING`,
  `REJECTED`, and `statusReason`; see
  [`phase-4a-establishment-management.md`](phase-4a-establishment-management.md).

### Category and EstablishmentCategory

- Categories are a shared discovery taxonomy.
- Phase 4A added `isActive` so categories can be retired without deleting links.
- `EstablishmentCategory` is an explicit many-to-many join with a composite primary key.
- Deleting an establishment removes its links; deleting a category is restricted.

### Service

- One bookable entity per row, owned by an establishment.
- `bookingType` distinguishes:
  - `APPOINTMENT`: one customer per duration slot.
  - `CLASS`: several customers up to `capacity`.
  - `RESOURCE`: a court or facility booked exclusively for a time range.
- `durationMinutes` and `capacity` are positive (enforced by a check constraint).
- `price` is `DECIMAL(10,3)` because the Tunisian dinar uses millimes.

### BusinessHours and UnavailablePeriod

- Business hours use local minutes since midnight (`0`–`1440`). Multiple intervals per day
  are supported for split schedules; duplicate identical intervals are rejected.
- Unavailable periods are absolute UTC ranges. A null `serviceId` closes the entire
  establishment; a non-null `serviceId` blocks one service.

### Reservation

- Links a customer, establishment, and service, plus start/end instants, status, party size,
  price snapshot, and optional notes.
- Statuses: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`, `NO_SHOW`.
- Indexes on `(serviceId, startsAt, endsAt)` and `(establishmentId, startsAt, endsAt)` support
  overlap and capacity queries.
- Check constraints require `endsAt > startsAt` and `partySize > 0`.

Overlap and capacity rules are intentionally not encoded as a single database exclusion
constraint: an appointment conflicts with any overlapping reservation, while a class permits
overlaps until `capacity` is reached. Future booking code will run the check and insert in a
transaction that locks the service row (or an equivalent serialised strategy) to prevent
double booking under concurrency.

### Favorite and Subscription

- `Favorite` uses `(userId, establishmentId)` as its composite primary key.
- Each establishment has at most one `Subscription`.
- Default plan is `Standard` at `69.000 TND` per month (`MONTHLY`), stored as decimal.

## Migration

- Migration `20261105215652_init` creates the enums, tables, indexes, and foreign keys.
- Additional check constraints cover ranges and positive values that Prisma cannot express.
- The migration was created with `--create-only`, SQL was reviewed, then applied with
  `prisma migrate deploy` against the empty local database.
- Phase 3 and Phase 4A later added additive migrations. `prisma migrate status` is the source of
  truth for the current migration set.
- No volume was removed and no database was reset.

## Deliberately deferred

- Phase 3 delivered authentication, password storage, refresh sessions, and authorization
  guards; see [`phase-3-authentication.md`](phase-3-authentication.md).
- Phase 4A delivered establishment, category, service, business-hours, and unavailable-period
  APIs plus public discovery; see
  [`phase-4a-establishment-management.md`](phase-4a-establishment-management.md).
- Reservation and availability APIs, plus advanced/geospatial search.
- Transactional booking/conflict logic and capacity enforcement.
- Payment provider integration and subscription lifecycle jobs.
- Owner and administrator dashboards.
- Broader booking and concurrency tests.
