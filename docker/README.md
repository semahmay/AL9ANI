# Docker

PostgreSQL runs through the root `docker-compose.yml` file. The API and web app currently
run on the host during development, so only the database is containerized in Phase 1.

## Start and stop

```bash
# From the repository root, after creating .env
npm run db:up
npm run db:status
npm run db:logs

# Stop the container (data is kept in the named volume)
npm run db:down
```

## Connection details

| Setting  | Source                  | Default         |
| -------- | ----------------------- | --------------- |
| Host     | `POSTGRES_PORT` binding | localhost       |
| Port     | `POSTGRES_PORT`         | 5432            |
| Database | `POSTGRES_DB`           | al9ani          |
| User     | `POSTGRES_USER`         | al9ani          |
| Password | `POSTGRES_PASSWORD`     | none — required |

The port is bound to `127.0.0.1` only. This keeps the database available to local tools
such as Prisma Studio while preventing access from the local network or the internet.

## Data persistence

Data is stored in the named Docker volume `al9ani-postgres-data`. Removing the container
with `docker compose down` keeps the data. Running `docker compose down -v` **deletes the
volume and all local data**, so use it only when you intentionally want a clean database.
