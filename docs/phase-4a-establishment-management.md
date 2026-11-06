# Phase 4A — Establishment and service management API

## Goal

Implement establishment, category, service, business-hours, and unavailable-period management on
top of the Phase 1–3 architecture. This phase stops before reservation creation, availability
generation, booking-conflict logic, billing, dashboards, and Flutter.

Existing data and migrations are preserved. The only schema migration in this phase is additive.

## Implemented modules

| Module                | Responsibility                                                        |
| --------------------- | --------------------------------------------------------------------- |
| `categories`          | Administrator category lifecycle and public active-category discovery |
| `establishments`      | Owner records, category assignment, submission, moderation, discovery |
| `services`            | Owner service lifecycle and public eligible-service discovery         |
| `business-hours`      | Recurring local opening intervals and split-interval validation       |
| `unavailable-periods` | Establishment-wide and service-specific closures                      |
| `common`              | Pagination, trimming/normalisation helpers, IANA time-zone validator  |

Controllers only translate HTTP input/output. Ownership checks, state transitions, relationship
validation, overlap detection, and persistence live in services.

All routes are protected by the existing global JWT and role guards unless marked `@Public()`.
Owners never supply an owner ID; every owner operation derives ownership from
`request.user.id`. A missing establishment and another owner's establishment intentionally both
return `404`.

## Endpoint and access matrix

### Public

| Method | Endpoint                           | Purpose                                                       |
| ------ | ---------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/categories`                  | Paginated active categories                                   |
| GET    | `/api/public/establishments`       | Paginated approved and publicly eligible establishments       |
| GET    | `/api/public/establishments/:slug` | One approved establishment by public slug                     |
| GET    | `/api/public/services`             | Paginated active services of approved eligible establishments |
| GET    | `/api/public/services/:id`         | One publicly eligible service                                 |

Public establishment discovery requires `Establishment.status = ACTIVE` and an active owner.
Public service discovery additionally requires `Service.isActive = true`. Public responses omit
owner identity, moderation status, and `statusReason`.

Supported public filters:

- Establishments: `q`, `city`, `category` (category slug), `page`, `limit`.
- Services: `q`, `city`, `category`, `establishmentId`, `establishmentSlug`, `page`, `limit`.

### Owner (`OWNER`)

| Method | Endpoint                                                              | Purpose                                       |
| ------ | --------------------------------------------------------------------- | --------------------------------------------- |
| POST   | `/api/establishments`                                                 | Create a draft establishment                  |
| GET    | `/api/establishments`                                                 | List the authenticated owner's establishments |
| GET    | `/api/establishments/:id`                                             | View an owned establishment                   |
| PATCH  | `/api/establishments/:id`                                             | Update details without changing status        |
| PUT    | `/api/establishments/:id/categories`                                  | Replace the category assignment               |
| POST   | `/api/establishments/:id/submit`                                      | Submit for administrator approval             |
| GET    | `/api/establishments/:id/status`                                      | View approval status and reason               |
| POST   | `/api/establishments/:establishmentId/services`                       | Create a service                              |
| GET    | `/api/establishments/:establishmentId/services`                       | List owned establishment services             |
| GET    | `/api/establishments/:establishmentId/services/:serviceId`            | View one service                              |
| PATCH  | `/api/establishments/:establishmentId/services/:serviceId`            | Update a service                              |
| POST   | `/api/establishments/:establishmentId/services/:serviceId/deactivate` | Deactivate a service                          |
| GET    | `/api/establishments/:establishmentId/business-hours`                 | List opening intervals and the time zone      |
| POST   | `/api/establishments/:establishmentId/business-hours`                 | Create one opening interval                   |
| PATCH  | `/api/establishments/:establishmentId/business-hours/:hoursId`        | Update one opening interval                   |
| DELETE | `/api/establishments/:establishmentId/business-hours/:hoursId`        | Delete one opening interval                   |
| GET    | `/api/establishments/:establishmentId/unavailable-periods`            | List closures                                 |
| POST   | `/api/establishments/:establishmentId/unavailable-periods`            | Create a closure                              |
| PATCH  | `/api/establishments/:establishmentId/unavailable-periods/:periodId`  | Update a closure                              |
| DELETE | `/api/establishments/:establishmentId/unavailable-periods/:periodId`  | Delete a closure                              |

Customers receive `403` on owner routes; unauthenticated requests receive `401`.

### Administrator (`ADMIN`)

| Method | Endpoint                                | Purpose                                      |
| ------ | --------------------------------------- | -------------------------------------------- |
| POST   | `/api/admin/categories`                 | Create a category                            |
| GET    | `/api/admin/categories`                 | List all categories, including inactive      |
| PATCH  | `/api/admin/categories/:id`             | Update a category                            |
| POST   | `/api/admin/categories/:id/activate`    | Activate a category                          |
| POST   | `/api/admin/categories/:id/deactivate`  | Deactivate a category without deleting links |
| GET    | `/api/admin/establishments`             | Inspect all establishments                   |
| GET    | `/api/admin/establishments/:id`         | Inspect one establishment and its owner      |
| POST   | `/api/admin/establishments/:id/approve` | Approve a pending establishment              |
| POST   | `/api/admin/establishments/:id/reject`  | Reject pending with a required reason        |
| POST   | `/api/admin/establishments/:id/suspend` | Suspend active with a required reason        |

Owners and customers receive `403` on administrator routes. Public administrator registration
remains prohibited.

## Establishment approval workflow

The Phase 2 status enum is extended with `PENDING` and `REJECTED`. `Establishment.statusReason`
stores the latest rejection or suspension reason. `Category.isActive` supports administrator
activation/deactivation.

```text
DRAFT ───────┐
             ├──> PENDING ──> ACTIVE ──> SUSPENDED
REJECTED ────┘         │
                       └──> REJECTED ──> PENDING (owner resubmission)

ARCHIVED is retained in the enum but has no Phase 4A transition endpoint.
```

Rules:

- Owners can submit only `DRAFT` or `REJECTED` establishments.
- Submission requires at least one active category. It clears any previous rejection reason.
- Approval applies only to `PENDING`; it sets `ACTIVE` and clears `statusReason`.
- Rejection applies only to `PENDING`; it sets `REJECTED` and requires a reason.
- Suspension applies only to `ACTIVE`; it sets `SUSPENDED` and requires a reason.
- Owners cannot set `status`, `statusReason`, `ownerId`, or review timestamps. Sending a
  non-whitelisted field such as `status` returns `400`.
- Establishment updates never change approval status.

## Validation rules

### Establishments

- Required on create: `name`, `city`.
- `name` 1–160 characters, `description` up to 10,000, `city` up to 120.
- `country` is an uppercase two-letter code and defaults to `TN`.
- `timezone` must be accepted by `Intl.DateTimeFormat` as an IANA time zone and defaults to
  `Africa/Tunis`.
- Latitude and longitude must be supplied together or both omitted. Ranges are
  `-90..90` and `-180..180` with at most six decimal places.
- Optional email, website (`http`/`https`), phone, address, governorate, and postal code are
  length/format validated. Nullable optional fields can be cleared with `null`.
- Public slugs are lowercase alphanumeric words separated by single hyphens. A slug is generated
  from the name when omitted; duplicate slugs and category names/slugs return `409`.
- Category IDs must exist and be active. Assignments replace the previous list. Duplicate IDs are
  rejected by DTO validation.

### Services

- Required on create: `name`, `bookingType`, `durationMinutes`, `price`.
- `name` is unique per establishment (case-sensitive database rule) and limited to 160 chars.
- `durationMinutes` is an integer from 1 to 1,440.
- `price` must be greater than `0` and fit `DECIMAL(10,3)`.
- `currency` defaults to `TND`; it is normalised to uppercase and must match three letters.
- Capacity rules:
  - `APPOINTMENT`: exactly `1`.
  - `CLASS`: at least `2`.
  - `RESOURCE`: at least `1`.
- Service updates cannot change `establishmentId`, `isActive`, or ownership. Deactivation uses the
  dedicated endpoint.
- Creating or updating a service always first verifies that the establishment belongs to the
  authenticated owner.

### Business hours

- Stored as local wall-clock minutes (`0..1440`) and interpreted in the establishment's IANA time
  zone; the list response returns that time zone explicitly.
- Requires `0 <= opensAtMinute < closesAtMinute <= 1440`.
- Multiple intervals per weekday are supported, but intervals on the same weekday must not
  overlap. Adjacent intervals such as `09:00–12:00` and `12:00–14:00` are allowed.
- Overnight intervals that cross midnight are not representable in this model; split them into
  same-day intervals or use a closure. This is documented as a future enhancement.

### Unavailable periods

- Start and end are ISO 8601 timestamps with an explicit offset or `Z`; `endsAt` must be later than
  `startsAt`.
- A null `serviceId` is establishment-wide. A non-null service must belong to the same
  establishment; a foreign or missing service returns `400`.
- Overlapping unavailability rows are permitted because they may represent layered operational
  reasons. Only range validity and ownership are enforced in this phase.

## Pagination and errors

All collection endpoints return:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

`limit` is capped at `100`. Business-hours list is a small bounded collection and returns the
establishment time zone plus intervals. Error responses keep the Phase 3 shape:

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Establishment not found.",
  "path": "/api/establishments/...",
  "timestamp": "2026-11-06T15:00:00.000Z"
}
```

Status codes:

- `400`: validation failure, invalid coordinates, invalid ranges, inactive/unknown categories,
  cross-establishment service reference, empty update body.
- `401`: missing or invalid access token.
- `403`: authenticated but wrong role.
- `404`: missing resource or a resource owned by another owner.
- `409`: duplicate category/establishment/service identifiers, duplicate exact hours interval, or
  an invalid lifecycle transition.

## Database changes and migration

Migration `20261106151057_establishment_management` is additive:

- Adds `PENDING` and `REJECTED` to the existing `EstablishmentStatus` PostgreSQL enum.
- Adds `Establishment.statusReason VARCHAR(500)`.
- Adds `Category.isActive BOOLEAN NOT NULL DEFAULT true` and an index.

No table is dropped, no column is removed, and no existing row is rewritten. The migration was
applied with `prisma migrate deploy`; `prisma migrate status` reports the schema up to date.
The local database was left with zero users, establishments, categories, services, business-hours
rows, unavailable periods, and refresh sessions after verification.

## Seed categories

The repeatable development seed adds:

- Beauty & Wellness
- Hair & Barber
- Pilates & Yoga
- Fitness & Gym
- Padel & Racquet Sports
- Sports & Leisure

Run it with:

```bash
npm run seed:categories
```

The script upserts by category slug, does not touch establishments, does not create fake
businesses or reservations, and does not reactivate categories an administrator chose to
deactivate.

## Automated tests

`npm test` now compiles and runs both integration suites:

- `test/auth.e2e.test.ts`: 12 authentication/authorization tests.
- `test/establishments.e2e.test.ts`: 9 Phase 4A tests.

Phase 4A coverage includes:

- Owner creation, listing, reading, updating, category assignment, and submission.
- Rejection of client-supplied `status` and `ownerId`.
- Cross-owner isolation for establishments, services, business hours, and unavailability.
- Administrator-only category and moderation actions.
- Approval, rejection with reason, resubmission, suspension with reason, and invalid transitions.
- Public hiding of draft, pending, rejected, and suspended establishments.
- Public hiding of inactive services and services of unapproved establishments.
- Active/inactive category assignment rules.
- Service booking-type, capacity, price, currency, duration, ownership, and mass-assignment rules.
- Split business hours, overlap detection, range validation, and time-zone reporting.
- Establishment-wide and service-specific closures, date ranges, and foreign-service rejection.
- Consistent `401`, `403`, `404` responses and cleanup of all prefix-named records.

### Results

| Check                                             | Result              |
| ------------------------------------------------- | ------------------- |
| `npm test`                                        | 21 passed, 0 failed |
| Authentication suite                              | 12 passed           |
| Phase 4A suite                                    | 9 passed            |
| Live endpoint checks on the built API             | 25 passed           |
| `npm run build` (API + web)                       | passed              |
| `npm run lint` (API + web)                        | passed              |
| `npm run format:check`                            | passed              |
| `npm run prisma:validate` / `generate` / `status` | passed, up to date  |
| Category seed executed twice                      | passed, idempotent  |

Live checks used the built `dist/main.js` on a temporary port and removed their temporary users,
category, establishment, service, business hours, and closure afterwards.

## Known limitations and open decisions

- **No reinstatement endpoint.** A suspended establishment cannot yet be returned to `ACTIVE`;
  approval intentionally accepts only `PENDING`. A future explicit `reinstate` action should be
  approved before implementation.
- **No archived workflow.** `ARCHIVED` remains a schema state with no API transition.
- **Active establishments can be edited without re-approval.** This keeps operations practical,
  but a future moderation policy may require sensitive edits to return a listing to `PENDING`.
- **No subscription gating in public discovery.** Eligibility is based on approved status and an
  active owner, not on `Subscription`, because billing is out of scope.
- **Business-hour overlap is checked in application code.** Concurrent writes could still create
  overlaps because there is no PostgreSQL exclusion constraint. A future migration should add one
  or wrap writes in a serialisable transaction.
- **No overlap rule for unavailable periods.** Layered closures are allowed; only positive ranges
  and ownership are validated.
- **Overnight business hours are not representable.** The schema uses `0..1440` within a single
  weekday. Supporting cross-midnight intervals needs a schema/API decision.
- **No service reactivation endpoint.** Owners can deactivate but not reactivate in Phase 4A.
- **No category deletion.** Deactivation preserves historical links and avoids destructive data
  changes.
- **No owner/administrator audit trail.** `statusReason` records why, but not which administrator
  performed the action. Authentication audit logging is deferred.
- **Currency is format-validated, not checked against a full ISO 4217 registry.** This avoids adding
  a dependency but permits well-formed non-published codes.
- **Public search is substring-based.** No geospatial radius, ranking, or full-text index yet.
- **No reservations, availability generation, booking conflicts, billing, dashboards, or Flutter.**
  Those remain separate phases.
