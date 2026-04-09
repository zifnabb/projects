# Media Stack

Streaming, photos, media management, and YouTube frontend.

## Services

| Service | Image | Port | Subdomain | Auth |
|---------|-------|------|-----------|------|
| Jellyfin | `jellyfin/jellyfin:latest` | 8096 | `cerulean.cooldad.top` | — |
| Jellyseerr | `fallenbagel/jellyseerr:latest` | 5055 | `nuggetbridge.cooldad.top` | Authentik |
| Sonarr | `lscr.io/linuxserver/sonarr:latest` | 8989 | `ceruleancave.cooldad.top` | Authentik |
| Radarr | `lscr.io/linuxserver/radarr:latest` | 7878 | `rocktunnel.cooldad.top` | Authentik |
| qBittorrent | `lscr.io/linuxserver/qbittorrent:latest` | 8090 | `powerplant.cooldad.top` | Authentik |
| Prowlarr | `lscr.io/linuxserver/prowlarr:latest` | 9696 | `mtmoon.cooldad.top` | Authentik |
| FlareSolverr | `ghcr.io/flaresolverr/flaresolverr:latest` | 8191 | — | — |
| Immich | `ghcr.io/immich-app/immich-server:release` | 2283 | `photos.cooldad.top` | — |
| Immich ML | `ghcr.io/immich-app/immich-machine-learning:release` | 3003 | — | — |
| Invidious | `quay.io/invidious/invidious:latest` | 8081 | `rocketcorner.cooldad.top` | — |
| Invidious Companion | `quay.io/invidious/invidious-companion:latest` | 8282 | `rockethideout.cooldad.top` | — |

## Data Flow

```
Jellyseerr (requests) → Sonarr/Radarr → Prowlarr (indexers) → qBittorrent (downloads)
                                                                    ↓
                                                          /mnt/media/downloads
                                                                    ↓
                                                    Sonarr/Radarr (import & rename)
                                                                    ↓
                                                          /mnt/media/tv or /movies
                                                                    ↓
                                                            Jellyfin (streaming)
```

## Media Paths

| Mount | Contents |
|-------|----------|
| `/mnt/Bill's Computer/movies` | Movie library |
| `/mnt/Memory Card/tv` | TV show library |
| `/mnt/Bill's Computer/downloads` | Movie download staging (Radarr/qBittorrent `/downloads/movies`) |
| `/mnt/Memory Card/downloads` | TV download staging (Sonarr/qBittorrent `/downloads/tv`) |
| `/mnt/Bill's Computer/photos` | Immich photo uploads |

## Service Notes

### Invidious

Self-hosted YouTube frontend, replaced Piped. Uses `invidious-postgres` (port 5435, user `kemal`) from the databases stack.

- **Port**: `8081` (reusing Piped's old backend port)
- **Config**: Inlined via `INVIDIOUS_CONFIG` env var in `docker-compose.yml`
- **Companion**: `invidious-companion` handles YouTube stream proxying. Binds to `0.0.0.0:8282` and is exposed publicly at `https://rockethideout.cooldad.top/companion` via NPM proxy host 16. Browser playback requires this companion URL.
- **Secrets** (via stack env): `INVIDIOUS_PG_PASS`, `INVIDIOUS_HMAC_KEY`, `INVIDIOUS_COMPANION_SECRET`

> **Note**: Companion serves under the `/companion` path, not root. Both `private_url` and `public_url` in the Invidious config must include the `/companion` suffix, or Invidious cannot reach it.

### Immich

Photo management with ML-powered search. Depends on `immich-postgres` and `immich-redis` (databases stack).

### qBittorrent

DNS set to `127.0.0.1` (Pi-hole) for ad-blocking on tracker connections. Downloads are split across two mounts: `/downloads/movies` → `/mnt/Bill's Computer/downloads`, `/downloads/tv` → `/mnt/Memory Card/downloads`.

## External Volume Dependencies

Uses external volumes originally created by `bkstacker`:
- `bkstacker_jellyfin_config`, `bkstacker_jellyfin_cache`
- `bkstacker_jellyseerr_config`
- `bkstacker_sonarr_config`, `bkstacker_radarr_config`
- `bkstacker_qbittorrent_config`, `bkstacker_prowlarr_config`
- `bkstacker_immich_ml_cache`
