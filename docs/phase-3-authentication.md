# Phase 3 — Authentication and authorization

## Goal

Add secure email/password authentication to the existing NestJS API without changing the
Phase 1/2 architecture or resetting the database. The API remains the single source of truth
for the future Next.js web app and the future Flutter mobile app.

## Implementation status

Implemented and verified:

- Registration for `CUSTOMER` and `OWNER`, login, logout, refresh rotation, and
  `GET /api/auth/me`.
- Argon2id password hashing, short-lived JWT access tokens, hashed rotating refresh sessions,
  and replay detection with family revocation.
- Global JWT and role guards, reusable `@Public()` and `@Roles()` decorators, and an
  `ADMIN`-only test route.
- Consistent validation/error responses, in-memory rate limiting, and CLI-only admin
  provisioning.
- Additive migration `20261105222004_auth_sessions` applied to the local database.
- Swagger bearer/cookie schemes and the endpoint documentation below.
- 12/12 integration tests and 55 live endpoint checks pass.

Out of scope for this phase and not implemented: establishment creation, reservations,
subscription payments, dashboards, and the Flutter app.

## Role model decision

The Phase 2 schema has one `UserRole` per user: `CUSTOMER`, `OWNER`, or `ADMIN`.

**Decision: keep the single role for the MVP.** An owner is a user whose primary capability
is managing establishments. In future authorization rules, `OWNER` will be allowed to perform
customer actions such as booking a service; the role represents the highest capability, not
an exclusive set of permissions.

Trade-offs:

| Option                                 | Benefit                                        | Cost                                           |
| -------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Single role (chosen)                   | Simplest schema, guards, and registration flow | Cannot express "owner and customer" explicitly |
| Multi-role join table                  | Fully expresses overlapping capabilities       | Extra table, queries, and migration complexity |
| Separate customer/owner profile tables | Clear domain separation                        | Duplicated identity and login logic            |

If future product rules require a user to hold both roles simultaneously, a `UserRole`
join table can be introduced without changing the existing `role` column immediately. That
is deliberately deferred until a concrete requirement exists.

## Authentication strategy

### Access token

- A short-lived signed JWT (HS256), default **15 minutes**.
- Sent by clients as `Authorization: Bearer <token>`.
- Contains only `sub` (user id), `role`, `type: "access"`, and standard JWT claims.
- Signed with `JWT_ACCESS_SECRET`, issuer `al9ani-api`, audience `al9ani-clients`.
- No password, email, or other profile data is placed in the token.
- Access tokens are stateless, so logout cannot revoke one before expiry. The short TTL
  limits this window. Refresh sessions are revoked immediately.

### Refresh token

- A random 384-bit opaque token, not a JWT. Default lifetime **30 days**.
- Only a SHA-256 hash is stored in `RefreshSession`; the plaintext token is never stored.
- Every refresh rotates the token. The previous row is marked revoked and linked to the new
  session.
- Each login chain has a `familyId`. Reusing an already-rotated or revoked token revokes the
  whole family, which detects replay/stolen refresh tokens and forces re-login.
- Logout revokes the current session family.

### Web vs mobile clients

Two delivery modes are supported by the same endpoints:

- **Web (`client: "web"`, default):** login/registration set the refresh token in an
  `HttpOnly` cookie. The access token is returned in JSON and should be held in memory by
  the Next.js client, not in `localStorage`. Cookies use:
  - `HttpOnly: true`
  - `Secure: true` in production
  - `SameSite=Lax` by default
  - `Path=/api/auth`
- **Mobile (`client: "mobile"`):** the refresh token is returned in the response JSON and
  must be stored in the platform secure store (Keychain/Keystore). No cookie is required.
  Refresh/logout read the token from the JSON body. The access token is still a bearer JWT.

Access tokens are never placed in cookies. Since protected requests use bearer tokens, they
are not vulnerable to CSRF. The refresh/logout routes use a SameSite=Lax cookie in web mode,
which blocks cross-site form posts; mobile mode uses an explicit body token. A future
cross-site web deployment would need `AUTH_COOKIE_SAME_SITE=none` plus HTTPS and a CSRF
token/origin check.

### Password hashing

- Argon2id via the `argon2` package.
- OWASP-aligned minimum parameters: 19 MiB memory, 2 iterations, 1 lane, 32-byte output.
- Passwords are never logged, stored, or returned. API responses use explicit safe user
  projections.
- Login returns a generic "Invalid email or password" for unknown emails, wrong passwords,
  and inactive accounts.

### Brute force, replay, and enumeration controls

- Global rate limit: 100 requests per minute per client.
- Authentication limits: registration and login 5 per minute; refresh and logout 30 per
  minute. This is in-memory throttling suitable for one API instance; a shared Redis store
  is a future scaling requirement.
- Refresh-token rotation plus family revocation detects replay.
- Registration deliberately exposes duplicate email with `409`, because a registration form
  must tell the user. Login does not reveal whether an email exists.
- Emails are trimmed and lowercased before storage and lookup.

### Administrator provisioning

Public registration accepts only `CUSTOMER` and `OWNER`. Requests with `role: "ADMIN"` are
rejected by validation.

Administrators are created through a controlled CLI command:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='a-long-random-password' npm run create-admin
```

The command hashes the password with Argon2id, creates or promotes the account, does not
print the password, and exits. It is environment-driven so the secret does not appear in
shell history in the documented form on Unix; Windows administrators should set the
variables in their shell or CI secret store.

### Error format

All HTTP errors use one shape:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid or expired access token.",
  "path": "/api/auth/me",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

Validation errors use an array of messages in `message`. Internal errors return a generic
message and are logged without request bodies or credentials.

## Endpoints

| Method | Path                   | Access        | Purpose                                          |
| ------ | ---------------------- | ------------- | ------------------------------------------------ |
| POST   | `/api/auth/register`   | Public        | Register a customer or owner                     |
| POST   | `/api/auth/login`      | Public        | Authenticate and issue tokens                    |
| POST   | `/api/auth/refresh`    | Public        | Rotate a refresh token and issue an access token |
| POST   | `/api/auth/logout`     | Public        | Revoke the refresh session and clear the cookie  |
| GET    | `/api/auth/me`         | Authenticated | Return the current safe user profile             |
| GET    | `/api/admin/ping`      | `ADMIN`       | Protected admin-only test route                  |
| GET    | `/api/health`          | Public        | Liveness (unchanged, no database access)         |
| GET    | `/api/health/database` | Public        | Database readiness (unchanged)                   |

`GET /api/auth/me` takes no user id. It always uses the authenticated token subject, so a
caller cannot request another user's identity by changing a parameter.

## Environment variables

| Variable                   | Purpose                                      | Default              |
| -------------------------- | -------------------------------------------- | -------------------- |
| `JWT_ACCESS_SECRET`        | Access JWT signing secret, at least 32 chars | required             |
| `JWT_ACCESS_TTL_SECONDS`   | Access token lifetime                        | `900`                |
| `JWT_REFRESH_TTL_SECONDS`  | Refresh session lifetime                     | `2592000` (30 days)  |
| `AUTH_COOKIE_NAME`         | Refresh cookie name                          | `al9ani_refresh`     |
| `AUTH_COOKIE_SECURE`       | Force Secure cookies                         | `true` in production |
| `AUTH_COOKIE_SAME_SITE`    | `lax`, `strict`, or `none`                   | `lax`                |
| `AUTH_RATE_LIMIT_LIMIT`    | Global requests per window                   | `100`                |
| `AUTH_RATE_LIMIT_TTL_MS`   | Global rate-limit window                     | `60000`              |
| `AUTH_RATE_LIMIT_DISABLED` | Disable throttling (tests only)              | `false`              |
| `ADMIN_EMAIL`              | Admin provisioning target                    | command only         |
| `ADMIN_PASSWORD`           | Admin provisioning password                  | command only         |
| `ADMIN_FIRST_NAME`         | Optional admin first name                    | `Al9ani`             |
| `ADMIN_LAST_NAME`          | Optional admin last name                     | `Admin`              |

Secrets are never placed in `.env.example`, logs, tokens, or API responses.

## Database changes

A new migration, `20261105222004_auth_sessions`, adds:

- `User.passwordHash` (`VARCHAR(255)`, nullable for existing rows and future external-auth
  accounts).
- `RefreshSession` with hashed token, family id, expiry, revocation, rotation link, and
  indexes for user, family, and expiry lookups.
- `User.refreshSessions` relation with `ON DELETE CASCADE`.

The migration is additive only. The existing Phase 2 tables, constraints, relationships, and
rows are preserved.

## Authorization rules

- `@Public()` marks health and auth entry points; every other route requires a valid access
  token by default.
- `JwtAuthGuard` verifies signature, expiry, issuer, audience, and token type.
- `RolesGuard` checks `@Roles(...)` metadata for authenticated users.
- `GET /api/auth/me` requires authentication but no specific role.
- `GET /api/admin/ping` requires `ADMIN`.
- Owners and customers receive `403` on admin routes.
- No endpoint accepts a user id that could be used to read another user's identity.

## Testing

Integration tests use the existing local PostgreSQL database and the real Nest application:

- Node's built-in test runner (no Jest migration required).
- `@nestjs/testing` and `supertest`.
- Tests set `NODE_ENV=test` and `AUTH_RATE_LIMIT_DISABLED=true`, create uniquely named users,
  and delete them afterwards. No database reset is used.
- The suite is compiled with `tsc` first (`tsconfig.test.json`) because validation and Nest
  dependency injection rely on emitted decorator metadata, which `tsx`/esbuild does not
  provide. This keeps the tests faithful to the production build.

Run it with PostgreSQL running and migrations applied:

```bash
npm test
```

The suite covers:

- Customer and owner registration, including mobile token delivery.
- Rejection of public `ADMIN` registration.
- Duplicate email (`409`) and malformed input (`400`) handling.
- Successful login, incorrect passwords, and equal errors for unknown emails.
- Unauthenticated, malformed, and expired access tokens.
- `GET /api/auth/me` resolving identity only from the token subject.
- Customer/owner `403` and unauthenticated `401` on admin routes, plus admin `200`.
- Web refresh-cookie rotation and replay family revocation.
- Mobile body-token rotation and replay revocation.
- Logout invalidating the refresh session.
- Public health and database-readiness endpoints.
- Password hashes never appearing in API responses.

### Results

| Check                                                                                   | Result                    |
| --------------------------------------------------------------------------------------- | ------------------------- |
| `npm test`                                                                              | 12 passed, 0 failed       |
| Live API checks (registration, login, guards, refresh, replay, logout, health, Swagger) | 55 passed                 |
| Rate limiting with a fresh process                                                      | 5 allowed, then `429`     |
| `npm run build` (API + web)                                                             | passed                    |
| `npm run lint` (API + web)                                                              | passed                    |
| `npm run format:check`                                                                  | passed                    |
| `npm run prisma:validate` / `generate` / `status`                                       | passed, schema up to date |

The runtime checks used the built `dist/main.js`, a temporary admin provisioned through
`npm run create-admin`, and temporary users that were deleted afterwards. The database was
left with zero users and zero refresh sessions, as before this phase.

## Known limitations / future work

- Access tokens remain valid until expiry after logout (bounded by 15 minutes).
- Role changes and account deactivation take effect for protected admin routes when the next
  access token is issued (at most 15 minutes). `refresh` and `/me` do re-check the database.
- Rate limiting is in-memory and per instance; production horizontal scaling needs a shared
  store.
- No email verification, password reset, MFA, or account recovery yet.
- No session listing/management UI yet.
- Refresh sessions are not proactively deleted after expiry; a scheduled cleanup is future
  work.
- Mobile clients must use secure platform storage and certificate pinning is a future
  decision.
- Admin provisioning and role changes are CLI/database operations, not dashboard features.
