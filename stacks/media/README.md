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
| Piped Frontend | `piped-frontend-custom:latest` | 8889 | `silphco.cooldad.top` | Authentik |
| Piped Backend | `1337kavin/piped:latest` | 8081 | `rocketcorner.cooldad.top` | — |
| Piped Proxy | `1337kavin/piped-proxy:latest` | 8080 | `rockethideout.cooldad.top` | — |

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
| `/mnt/media/movies` | Movie library |
| `/mnt/media/tv` | TV show library |
| `/mnt/media/downloads` | Download staging area |
| `/mnt/media/photos` | Immich photo uploads |

## Service Notes

### Piped

Self-hosted YouTube frontend with three components. Config files live at `/root/stacks/bkstacker/piped/`.

- **Backend** runs on port `8081` (not the default 8080). The `PORT` env var must be set to `8081` for the Docker healthcheck to work.
- **Frontend** is a custom-built image (`piped-frontend-custom:latest`).
- **Depends on**: `piped-postgres` and `piped-redis` (databases stack)

### Immich

Photo management with ML-powered search. Depends on `immich-postgres` and `immich-redis` (databases stack).

### qBittorrent

DNS set to `127.0.0.1` (Pi-hole) for ad-blocking on tracker connections.

## External Volume Dependencies

Uses external volumes originally created by `bkstacker`:
- `bkstacker_jellyfin_config`, `bkstacker_jellyfin_cache`
- `bkstacker_jellyseerr_config`
- `bkstacker_sonarr_config`, `bkstacker_radarr_config`
- `bkstacker_qbittorrent_config`, `bkstacker_prowlarr_config`
- `bkstacker_immich_ml_cache`
