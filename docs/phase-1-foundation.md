# Phase 1 — Project foundation

> Phase 2 later added Prisma and the initial schema. See
> [`phase-2-database.md`](phase-2-database.md) for the current database setup.

## Goal

Establish a maintainable monorepo with one shared NestJS API, one Next.js web application,
and a reproducible local PostgreSQL environment. Product features are intentionally out of
scope.

## Structure

```text
al9ani/
├── apps/
│   ├── api/        NestJS API (TypeScript, Swagger)
│   └── web/        Next.js web application (TypeScript, App Router)
├── docker/         Docker documentation
├── docs/           Architecture and phase notes
├── docker-compose.yml
└── package.json    npm workspaces root
```

## Decisions

### npm workspaces

A single root `package-lock.json` keeps dependency resolution consistent across both apps.
Each app remains independently runnable through its own npm scripts.

### No Prisma in Phase 1

The Phase 1 health endpoint does not need database access, so adding a Prisma schema,
client generation, and a migration would add unverified infrastructure. PostgreSQL is
running and ready; Prisma will be introduced at the start of Phase 2 together with the first
real data model (likely business and service listings). The `DATABASE_URL` will then be
derived from the existing `POSTGRES_*` values.

### Swagger only outside production

Swagger UI is mounted at `/docs` when `NODE_ENV` is not `production`. Production
environments should expose documentation only if it is deliberately made public.

### Database exposure

PostgreSQL binds to `127.0.0.1` on the host. It is not reachable from other machines. The
container uses a named volume and a health check based on `pg_isready`.

## API contract (Phase 1)

`GET /api/health`

```json
{
  "status": "ok",
  "service": "Al9ani API",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "uptime": 12.34
}
```

## Out of scope

- Authentication and authorization
- Business, service, availability, and reservation models
- Owner and administrator dashboards
- Payments and subscriptions
- Flutter mobile application
- Public deployment

## Suggested Phase 2 order

1. Add Prisma with an initial schema and migration workflow.
2. Model users, businesses, services, availability, and reservations.
3. Add authentication and role separation.
4. Build the owner dashboard APIs and UI.
5. Add tests around booking rules and authorization.
