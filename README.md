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

### Internal / Test Hosts
- `terrenceb-dl` (10.33.22.17) — internal development/test box, accessed via nested SSH through LavenderTown.
- Important path for test work: `/media/terrenceb/mnt/testbox_home/copilot/Test-cases/` (enrichment, JIRA/Testlink tooling and data).
- **That tree is remote-only — there is no `Test-cases/` directory in this repo** (as of 2026-07-31). Earlier revisions described a local mirror and linked to `Test-cases/README.md`; neither exists. Sync patterns for pulling a working copy down are in [AGENTS.md](AGENTS.md).
- Project framing: improving AWPTCM Manual Test Cases by deriving Objectives from TestLink history + enriched Automated Suites, plus many-to-one suite-to-manual mappings.

## Stacks

| Stack | Description | Services |
|-------|-------------|----------|
| [bigstackd](stacks/bigstackd/) | Core system services | Pi-hole, Cloudflared, Vaultwarden, Authentik |
| [infra](stacks/infra/) | Infrastructure & tooling | NPM, Uptime Kuma, Baikal |
| [databases](stacks/databases/) | Shared database layer | PostgreSQL x3, Redis x2 |
| [media](stacks/media/) | Streaming, photos & media | Jellyfin, *arr suite, Immich, Invidious |
| [mailserver](stacks/mailserver/) | Self-hosted email | Docker Mailserver, SnappyMail |
| [lavender-dashboard](stacks/lavender-dashboard/) | Dashboard | LavenderTown Dashboard |
| [mcp](stacks/mcp/) | MCP server for local AI | lavender-mcp (Docker + stack management tools) |
| [deckbuilder](stacks/deckbuilder/) | Private MTG deck builder | deckbuilder (`vermilion`) + deckbuilder-postgres |

**Deckbuilder ("vermilion") — live since 2026-07-19** at [vermilion.cooldad.top](https://vermilion.cooldad.top): a private, invite-only, Commander-focused MTG deck builder (Archidekt-style, zero community surface). React SPA + FastAPI + PostgreSQL, custom-build stack (tar → `/root/stacks/deckbuilder/` → `build: .`); app's own invite-only login, **no Authentik**. Cloudflare Tunnel route: `http://localhost:80` (plain HTTP into NPM — an `https://` scheme there causes 502 "not a TLS handshake"). Full 19-section design in [stacks/deckbuilder/PLAN.md](stacks/deckbuilder/PLAN.md); status + infra in [stacks/deckbuilder/README.md](stacks/deckbuilder/README.md); dev loop + redeploy steps in [deckbuilder/README.md](deckbuilder/README.md).

## Port Map

| Port | Service | Stack |
|------|---------|-------|
| 25 | Docker Mailserver (SMTP) | mailserver |
| 53 | Pi-hole (DNS) | bigstackd |
| 67 | Pi-hole (DHCP) | bigstackd |
| 80 | NPM (HTTP) | infra |
| 81 | NPM (Admin UI) | infra |
| 143 | Docker Mailserver (IMAP) | mailserver |
| 443 | NPM (HTTPS) | infra |
| 465 | Docker Mailserver (SMTPS) | mailserver |
| 587 | Docker Mailserver (Submission) | mailserver |
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
| 8099 | Deckbuilder ("vermilion") | deckbuilder |
| 5436 | PostgreSQL — Deckbuilder | databases |
| 8191 | FlareSolverr | media |
| 8282 | Invidious Companion | media |
| 8888 | SnappyMail | mailserver |
| 8989 | Sonarr | media |
| 9010 | Authentik (HTTP) | bigstackd |
| 9301 | Authentik (Metrics) | bigstackd |
| 9444 | Authentik (HTTPS) | bigstackd |
| 9696 | Prowlarr | media |
| 3389 | xrdp (RDP desktop access) | host |

## Remote Desktop (RDP / XFCE)

LavenderTown has xrdp installed on the host for graphical desktop sessions (XFCE4).

**Client on macOS**: Microsoft **Windows App** (formerly Microsoft Remote Desktop from the App Store / Mac App Store).

**How to connect**:
- Add a new PC / connection.
- PC name / Host: the server's address that can reach TCP port 3389 directly.
  - Typically the LAN IP (e.g. `192.168.x.x` or `10.33.x.x`) or a VPN hostname (Tailscale, etc.).
  - **Note**: `diglettscave.cooldad.top` and Cloudflare Tunnel + NPM are for HTTP/SSH only. Raw RDP (3389) requires direct/LAN/VPN reachability.
- Port: `3389` (default).
- User name: `mrfuji`
- Connect with your normal user password.

The session starts XFCE4 (with tweaks in `~/.xsession` for better RDP compatibility: X11 forced, compositing off, no screen blanking).

**Internal ports**:
- 3389: xrdp (public-facing for the RDP protocol)
- 3350: xrdp-sesman (localhost only — the session manager that xrdp talks to)

If you ever see "Error connecting to sesman on 127.0.0.1:3350", restart the services on the host:
```sh
sudo systemctl restart xrdp xrdp-sesman
```

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
| `vermilion.cooldad.top` | Deckbuilder | app login (invite-only) |
| `viridian.cooldad.top` | Baikal | - |
| `webmail.cooldad.top` | SnappyMail | - |

## Directory Structure

```
stacks/
├── bigstackd/              # Pi-hole, Cloudflared, Vaultwarden, Authentik
├── infra/                  # NPM, Uptime Kuma, Baikal
├── databases/              # PostgreSQL x3, Redis x2
├── media/                  # Jellyfin, *arr, Immich, Invidious
├── mailserver/             # Docker Mailserver, SnappyMail
├── lavender-dashboard/     # LavenderTown Dashboard
└── mcp/                    # MCP server for local AI agents
```

Each stack directory contains:
- `README.md` — stack-specific documentation, configuration notes, and upgrade instructions

For most stacks, `docker-compose.yml` is also present (mirrors what Dockge manages). For custom-built images (lavender-dashboard, mcp), the build context (Dockerfile + source) lives in a sibling directory at the repo root; a reference compose may be synced into the stack dir for Dockge builds using `build: .`.

## Planned Services

Not yet **publicly shipped** — ports/subdomains reserved here to avoid collisions. These deliberately stay out of the live Port Map / Subdomains tables and the dashboard config until they're reachable via NPM/Cloudflare.

*(none currently — Deckbuilder shipped 2026-07-19 and now lives under [Stacks](#stacks).)*

## Legacy

The `bkstacker` stack on the server is the original monolith that all current stacks were split from. Its named volumes are still referenced as external volumes by the `infra` and `media` stacks. The `authentik` stack directory on the server appears to be an earlier standalone attempt and is superseded by the `bigstackd` and `databases` configurations.

**Deprecated / Removed services (as of 2026-07):**

- **LunaMultiplayer (LMP / lunamultiplayer)**: KSP multiplayer server (PlagueNZ SplitProgression fork). All containers and custom `lmp-splitprog:*` images removed. The server-side stack directory no longer exists. UDP port 8800 service discontinued. See `stacks/lunamultiplayer/README.md` (archived) for historical configuration and universe notes. **No longer required or maintained until further notice.**

- **Satisfactory**: Test game server (`wolveix/satisfactory-server`). **Fully removed 2026-07-31.** An earlier revision claimed the stack directory was deleted in July; it wasn't — `/root/stacks/satisfactory/` survived with 2.8 GB (2.8 GB of redownloadable Steam gamefiles, plus 4.5 KB of settings and *no* world saves), and the container was still running. It was still running because it belonged to a second, undocumented Docker daemon — see Portainer below. Container stopped, directory deleted, 2.8 GB reclaimed.

- **Portainer**: `portainer/portainer-ce:sts` + `portainer/agent:2.39.0`, on ports **9443** (UI) and **8000** (edge agent), bound to `0.0.0.0`. **Removed 2026-07-31.** Leftover from before the migration to Dockge and never documented — it survived because the host was running **two Docker daemons at once**:
  - `snap.docker.dockerd.service` (root `/var/snap/docker/common/var-lib-docker`) — the 30-container fleet, and the daemon both `/run/docker.sock` and `/var/run/docker.sock` actually answer on.
  - `docker.service` (apt, root `/var/lib/docker`) — held only Portainer, its agent, and Satisfactory. Snap had taken over its socket path, so it ran **headless**: `docker ps` could not see its containers, but it kept enforcing their restart policies. Killing those containers by PID just respawned them.
  - Resolution: `docker.service` and `docker.socket` stopped and **disabled**. The fleet was unaffected throughout. Diagnostic worth keeping: `sudo ctr -n moby containers ls` sees containers `docker ps` cannot.
  - Fallout: `cloudflared` had been created by that Portainer and still carried its stack labels. Recreated from `stacks/bigstackd/compose.yaml` on 2026-07-31 (~15s tunnel outage) — **all 30 containers are now Dockge-managed from `/root/stacks/`.** Procedure for recreating host-critical containers is in [AGENTS.md](AGENTS.md).
  - `/var/lib/docker` (948 MB — Portainer's images and its `portainer_data` / `portainer_agent_data` volumes) deleted 2026-07-31. The apt `docker` package itself is still installed but its units are disabled; purge it if you want the binaries gone too.

These services have been fully purged from Docker and the stack layout. Documentation has been annotated; they can be reintroduced later if needed.
