# Bigstackd

DNS, Cloudflare tunnel, password management, and SSO authentication.

## Services

| Service | Image | Port | Subdomain | Auth |
|---------|-------|------|-----------|------|
| Pi-hole | `pihole/pihole:latest` | 8088 (Web UI), 53 (DNS), 67 (DHCP) | `fuschia.cooldad.top` | Authentik |
| Cloudflared | `cloudflare/cloudflared:latest` | — | — | — |
| Vaultwarden | `vaultwarden/server:latest` | 8084 | `cinnabar.cooldad.top` | — |
| Authentik Server | `ghcr.io/goauthentik/server:2026.2` | 9010 (HTTP), 9444 (HTTPS), 9301 (Metrics) | `auth.cooldad.top` | — |
| Authentik Worker | `ghcr.io/goauthentik/server:2026.2` | — | — | — |

## Service Details

### Pi-hole (DNS & DHCP)

Network-wide DNS ad-blocking and DHCP server.

- **Upstream DNS**: `1.1.1.1`, `8.8.8.8`
- **DHCP range**: Configured via env vars (`DHCP_START`, `DHCP_END`, `DHCP_ROUTER`)
- **Capability**: `NET_ADMIN` (required for DHCP)

### Cloudflared (Tunnel)

Cloudflare Tunnel connecting internal services to `*.cooldad.top` subdomains via NPM.

- **Protocol**: HTTP/2
- **Token**: Provided via `TUNNEL_TOKEN` env var
- **CRITICAL**: This container must not go down — it provides all external access including SSH

### Vaultwarden (Password Manager)

Bitwarden-compatible password vault.

- **Data**: `/home/mrfuji/vaultwarden`
- **Signups**: Disabled, invitations only

### Authentik (SSO / Identity Provider)

Forward auth proxy protecting services behind Cloudflare tunnel subdomains.

- **Depends on**: `authentik-postgres` (databases stack), Redis on `localhost:6379`
- **Data**: `/mnt/Memory Card/docker-data/authentik-media`, `authentik-templates`
- **Email**: Sends via `localhost:25` (Docker Mailserver) from `auth@cooldad.top`

#### Outpost Configuration

The embedded outpost handles forward auth for NPM. Key config in the database:

- `authentik_host`: `https://auth.cooldad.top` — used by the outpost for OAuth authorization URLs
- `authentik_host_browser`: `https://auth.cooldad.top` — browser-facing redirect URL
- Brand domain: `auth.cooldad.top`

If auth stops redirecting to the login page (redirects to `localhost:9010` instead), these values have been reset. Fix via:

```sql
-- Fix outpost config
UPDATE authentik_outposts_outpost
SET _config = '{"authentik_host": "https://auth.cooldad.top", "authentik_host_browser": "https://auth.cooldad.top"}'
WHERE name = 'authentik Embedded Outpost';

-- Fix brand domain
UPDATE authentik_brands_brand
SET domain = 'auth.cooldad.top'
WHERE "default" = true;
```

Then restart `authentik-server` and `authentik-worker` (NOT the full stack — cloudflared must stay up).

## Notes

- When restarting Authentik, always use `docker restart authentik-server authentik-worker` or targeted `docker compose up -d` — never restart the full stack or cloudflared will drop.
