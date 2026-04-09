# Infra Stack

Reverse proxy, monitoring, and calendar.

## Services

| Service | Image | Port | Subdomain | Auth |
|---------|-------|------|-----------|------|
| Nginx Proxy Manager | `jc21/nginx-proxy-manager:latest` | 80 (HTTP), 81 (Admin UI), 443 (HTTPS) | — | — |
| Uptime Kuma | `louislam/uptime-kuma:latest` | 3001 | `pewter.cooldad.top` | Authentik |
| Baikal | `ckulka/baikal:apache` | 8085 | `viridian.cooldad.top` | — |

## Service Details

### Nginx Proxy Manager (NPM)

Reverse proxy for all externally-accessible services. Cloudflare tunnel terminates at NPM, which routes by subdomain. Also handles Authentik forward auth integration for protected services.

- **Admin UI**: `http://<server>:81` (note: compose sets `HTTP_PORT=8181`/`HTTPS_PORT=8443`, but these env vars are ignored under `network_mode: host` — nginx binds 80/81/443)
- **Volumes**: `npm_data`, `npm_letsencrypt` (external, from bkstacker)

### Uptime Kuma

Uptime monitoring for all services and endpoints.

- **Volumes**: `uptime_kuma_data` (external, from bkstacker)
- **Docker socket**: Yes (for container monitoring)

### Baikal

Lightweight CalDAV/CardDAV server for self-hosted calendars and contacts.

- **Data**: `/mnt/Memory Card/docker-data/baikal-config`, `baikal-data`
- **Subdomain**: `viridian.cooldad.top`
- **Database**: SQLite at `/var/www/baikal/Specific/db/db.sqlite`
- **Auth type**: Basic (over HTTPS via Cloudflare tunnel)
- **DAVx5 URL**: `https://viridian.cooldad.top/dav.php`
- **User**: `terrence`
- **Calendars**: Default, Allied Telesis, Protonmail

## External Volume Dependencies

This stack uses external volumes originally created by `bkstacker`:
- `bkstacker_npm_data`
- `bkstacker_npm_letsencrypt`
- `bkstacker_uptime_kuma_data`

## Network

All services use `network_mode: host` except Baikal (port-mapped `8085:80`).
