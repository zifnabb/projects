# Databases Stack

Centralized database services shared across multiple stacks.

## Services

### PostgreSQL

| Container | Image | Port | Database | Used By |
|-----------|-------|------|----------|---------|
| authentik-postgres | `postgres:16-alpine` | 5434 | authentik | Authentik (bigstackd) |
| immich-postgres | `tensorchord/pgvecto-rs:pg14-v0.2.0` | 5432 | immich | Immich (media) |
| invidious-postgres | `postgres:15-alpine` | 5435 | invidious | Invidious (media) |

### Redis

| Container | Image | Port | Used By |
|-----------|-------|------|---------|
| immich-redis | `redis:6.2-alpine` | 6379 | Immich (media) |

## Data Storage

All data on `/mnt/Memory Card/docker-data/`:

| Directory | Service |
|-----------|---------|
| `authentik-pg/` | Authentik PostgreSQL |
| `immich-pg/` | Immich PostgreSQL |
| `invidious-pg/` | Invidious PostgreSQL |
| `immich-redis/` | Immich Redis |

## Notes

- All services use `network_mode: host` — port conflicts are avoided via custom port assignments
- Authentik also uses Redis on the default port `6379`, but that instance is not in this stack (it runs on localhost shared with the Authentik containers in bigstackd)
- `immich-postgres` uses the pgvecto-rs image for Immich's ML vector search
- Invidious uses PostgreSQL with user `kemal` (Invidious convention); no Redis dependency
