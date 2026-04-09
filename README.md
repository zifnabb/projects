# Homelab Stacks

Documentation and Docker Compose configurations for managing homelab container stacks via [Dockge](https://github.com/louislam/dockge).

## Server Overview

- **Hostname**: LavenderTown
- **Management**: Dockge (`:5001`)
- **Runtime**: Docker Compose
- **Architecture**: Single server, multiple container stacks
- **Domain**: `*.cooldad.top` (via Cloudflare Tunnel)
- **SSH**: `mrfuji@diglettscave.cooldad.top` (Cloudflare Tunnel)
- **Stack path**: `/root/stacks/`
- **Media storage**: `/mnt/Bill's Computer/` (movies, downloads, photos) and `/mnt/Memory Card/` (tv, downloads)
- **Docker data**: `/mnt/Memory Card/docker-data/`

## Stacks

| Stack | Description | Services |
|-------|-------------|----------|
| [bigstackd](stacks/bigstackd/) | Core system services | Pi-hole, Cloudflared, Vaultwarden, Authentik |
| [infra](stacks/infra/) | Infrastructure & tooling | NPM, Uptime Kuma, Baikal |
| [databases](stacks/databases/) | Shared database layer | PostgreSQL x3, Redis x2 |
| [media](stacks/media/) | Streaming, photos & media | Jellyfin, *arr suite, Immich, Invidious |
| [mailserver](stacks/mailserver/) | Self-hosted email | Docker Mailserver, SnappyMail |
| [lavender-dashboard](stacks/lavender-dashboard/) | Dashboard | LavenderTown Dashboard |

## Port Map

| Port | Service | Stack |
|------|---------|-------|
| 25 | Docker Mailserver (SMTP) | mailserver |
| 53 | Pi-hole (DNS) | bigstackd |
| 67 | Pi-hole (DHCP) | bigstackd |
| 143 | Docker Mailserver (IMAP) | mailserver |
| 587 | Docker Mailserver (Submission) | mailserver |
| 993 | Docker Mailserver (IMAPS) | mailserver |
| 2283 | Immich | media |
| 3001 | Uptime Kuma | infra |
| 3003 | Immich ML | media |
| 5001 | Dockge | (system) |
| 5055 | Jellyseerr | media |
| 5432 | PostgreSQL — Immich | databases |
| 5435 | PostgreSQL — Invidious | databases |
| 5434 | PostgreSQL — Authentik | databases |
| 6379 | Redis — Immich | databases |
| 7575 | LavenderTown Dashboard | lavender-dashboard |
| 7878 | Radarr | media |
| 8084 | Vaultwarden | bigstackd |
| 8085 | Baikal | infra |
| 8081 | Invidious | media |
| 8088 | Pi-hole (Web UI) | bigstackd |
| 8090 | qBittorrent | media |
| 8096 | Jellyfin | media |
| 8181 | NPM (HTTP Admin) | infra |
| 8191 | FlareSolverr | media |
| 8282 | Invidious Companion (localhost) | media |
| 8443 | NPM (HTTPS) | infra |
| 8888 | SnappyMail | mailserver |
| 8989 | Sonarr | media |
| 9010 | Authentik (HTTP) | bigstackd |
| 9301 | Authentik (Metrics) | bigstackd |
| 9444 | Authentik (HTTPS) | bigstackd |
| 9696 | Prowlarr | media |

## Known Subdomains (Cloudflare Tunnel → NPM)

| Subdomain | Service | Auth |
|-----------|---------|------|
| `auth.cooldad.top` | Authentik | - |
| `celadon.cooldad.top` | LavenderTown Dashboard | Authentik |
| `cerulean.cooldad.top` | Jellyfin | - |
| `ceruleancave.cooldad.top` | Sonarr | Authentik |
| `cinnabar.cooldad.top` | Vaultwarden | - |
| `diglettscave.cooldad.top` | SSH | - |
| `fuschia.cooldad.top` | Pi-hole | Authentik |
| `mtmoon.cooldad.top` | Prowlarr | Authentik |
| `nuggetbridge.cooldad.top` | Jellyseerr | Authentik |
| `pallet.cooldad.top` | Dockge | Authentik |
| `pewter.cooldad.top` | Uptime Kuma | Authentik |
| `photos.cooldad.top` | Immich | - |
| `powerplant.cooldad.top` | qBittorrent | Authentik |
| `rocketcorner.cooldad.top` | Invidious | - |
| `rockethideout.cooldad.top` | Invidious Companion | - |
| `rocktunnel.cooldad.top` | Radarr | Authentik |
| `viridian.cooldad.top` | Baikal | - |
| `webmail.cooldad.top` | SnappyMail | - |

## Directory Structure

```
stacks/
├── bigstackd/              # Pi-hole, Cloudflared, Vaultwarden, Authentik
├── infra/                  # NPM, Uptime Kuma, Baikal
├── databases/              # PostgreSQL x3, Redis x2
├── media/                  # Jellyfin, *arr, Immich, Piped
├── mailserver/             # Docker Mailserver, SnappyMail
└── lavender-dashboard/     # LavenderTown Dashboard
```

Each stack directory contains:
- `docker-compose.yml` — the Compose file (mirrors what Dockge manages)
- `README.md` — stack-specific documentation, configuration notes, and upgrade instructions

## Legacy

The `bkstacker` stack on the server is the original monolith that all current stacks were split from. Its named volumes are still referenced as external volumes by the `infra` and `media` stacks. The `authentik` stack directory on the server appears to be an earlier standalone attempt and is superseded by the `bigstackd` and `databases` configurations.
