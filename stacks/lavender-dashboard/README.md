# LavenderTown Dashboard

Custom homelab dashboard replacing the previous Homepage (gethomepage). Built with Python FastAPI and vanilla JS.

## Services

| Service | Image | Port | Subdomain | Auth |
|---------|-------|------|-----------|------|
| LavenderTown Dashboard | `lavender-dashboard` (local build) | 7575 | `celadon.cooldad.top` | Authentik |

## Features

- **Container health grid** — All containers grouped by stack with status, health, uptime, and image
- **Network topology** — SVG flow diagram: Internet → Cloudflare → NPM → services with Authentik auth badges
- **System monitoring** — CPU, RAM gauges with live updates via SSE
- **Storage** — Usage bars for all 4 drives (Boot, Shigawire, Memory Card, Bill's Computer)
- **Clickable service links** — Container cards and topology nodes link to service subdomains
- **Mobile responsive** — Touch-optimized layout, scroll hints, PWA-ready

## Tech Stack

- **Backend**: Python 3.12, FastAPI, `docker` SDK, `psutil`
- **Frontend**: Vanilla HTML/CSS/JS (no build step)
- **Updates**: Server-Sent Events (SSE) — system stats every 5s, containers every 10s

## Configuration

Service mappings, subdomain-to-container routing, disk paths, and link exclusions are all defined in [app/config.py](app/config.py).

To add a new service to the dashboard, add an entry to `SUBDOMAINS` in config.py and rebuild.

To exclude a service from having clickable links, add its container name to `NO_LINK`.

## Volumes

| Host Path | Container Path | Purpose |
|-----------|---------------|---------|
| `/var/run/docker.sock` | `/var/run/docker.sock` | Docker API (read-only) |
| `/proc` | `/host/proc` | Host CPU/memory stats |
| `/sys` | `/host/sys` | Host system info |
| `/home` | `/host/home` | Boot drive usage stats |
| `/mnt/Shigawire` | `/host/mnt/Shigawire` | Shigawire drive stats |
| `/mnt/Memory Card` | `/host/mnt/Memory Card` | Memory Card drive stats |
| `/mnt/Bill's Computer` | `/host/mnt/Bill's Computer` | Bill's Computer drive stats |

## Build & Deploy

```bash
cd /root/stacks/lavender-dashboard
docker compose up -d --build
```

The image is built locally on the server — no registry push needed. Dockge manages it like any other stack.

## Notes

- Container is `read_only: true` — no persistent state
- Uses `network_mode: host` like all other services
- Disk stats for the boot drive use `/home` as a probe point (bind-mounting `/` gives overlay FS stats inside Docker)
