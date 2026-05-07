# Luna Multiplayer Stack

KSP multiplayer game server using the [PlagueNZ SplitProgression fork](https://github.com/PlagueNZ/LunaMultiplayer-SplitProgression) of LunaMultiplayer.

## Services

| Service | Image | Port | Protocol |
|---------|-------|------|----------|
| lunamultiplayer | `lmp-splitprog:master-contractfix` | 8800 | UDP |

- **Server name**: `FromUndahCheese`
- **Network**: `host` mode — container binds directly to host network stack (required for LMP NAT punchthrough)
- **Stack path (server)**: `/root/stacks/lunamultiplayer/`
- **TZ**: `Pacific/Auckland`

## Image

`lmp-splitprog:master-contractfix` — built from PlagueNZ/LunaMultiplayer-SplitProgression commit `a1176729` (post v29.01-28, pre-release). Multi-stage build via `Dockerfile_Server` (.NET 10 SDK → self-contained Alpine). Build source at `/root/stacks/lunamultiplayer/server-build/` on server.

## Data Layout

```
/root/stacks/lunamultiplayer/
├── compose.yaml
├── data/
│   ├── Config/       # Server settings XML files (bind-mounted)
│   ├── Universe/     # Career saves, vessels, scenarios (bind-mounted)
│   ├── Plugins/      # Server-side plugins (bind-mounted)
│   └── logs/         # Server logs (bind-mounted)
└── server-build/     # Dockerfile + source for image builds
```

## Configuration

### Career Mode (as of 2026-05-05)

Fully shared career — all Split flags disabled:

| Setting | Value |
|---------|-------|
| `SplitCareer` | `false` |
| `SplitFunds` | `false` |
| `SplitScience` | `false` |
| `SplitReputation` | `false` |
| `SplitTechnology` | `false` |
| `SplitContracts` | `false` |
| `SplitAchievements` | `false` |
| `SplitStrategy` | `false` |
| `SplitFacilityUpgrade` | `false` |
| `SplitPartPurchase` | `false` |
| `SplitExperimentalPart` | `false` |
| `SplitKerbals` | `false` |

Other notable settings: reverts enabled, 168h respawn, 1.2x gain multipliers, 0 decline penalty, G/pressure limits enabled, comm blackout, DSN 1.5x, 2x resources, AutoDekessler every 60 min.

### Mod Control

`LMPModControl.xml` — `AllowNonListedPlugins: true`, 134 optional DLL entries. Required expansions: **Making History**, **Serenity**.

To update: replace `data/Config/LMPModControl.xml` and restart.

## Networking

NAT punchthrough via LMP master server — no router port-forward needed for browser-discovered connections. UDP 8800 is also forwarded on the router to `192.168.1.222` for direct-IP connects.

## Operations

### Restart (apply config changes)

**Always restart twice.** A stale UDP packet hits the server on every first startup and causes a fatal deserialization error that blocks all connections. The second restart clears it.

```sh
sudo bash -c 'cd /root/stacks/lunamultiplayer && docker compose down && docker compose up -d'
# wait ~5 seconds, then:
sudo bash -c 'cd /root/stacks/lunamultiplayer && docker compose down && docker compose up -d'
```

> **Never use `docker compose restart`** — it does not fully flush the UDP buffer and will leave stale packets.

### Reset Universe (wipe all career progress)

Wipe **while the container is down** to prevent the server from flushing cached state back to disk on next startup. Then apply the mandatory double restart:

```sh
sudo bash -c 'cd /root/stacks/lunamultiplayer && docker compose down && rm -rf data/Universe/*'
sudo bash -c 'cd /root/stacks/lunamultiplayer && docker compose up -d'
# wait ~5 seconds, then:
sudo bash -c 'cd /root/stacks/lunamultiplayer && docker compose down && docker compose up -d'
```

> **Never wipe Config unless explicitly intended** — this holds passwords, game mode, mod control, and all server settings.

### Push a config file from local
```sh
cat <local-file> | ssh mrfuji@diglettscave.cooldad.top 'sudo tee /root/stacks/lunamultiplayer/data/Config/<filename> > /dev/null'
```

### Update Image
1. In `/root/stacks/lunamultiplayer/server-build/`: `git fetch --tags && git checkout <tag>`
2. `docker build --file Dockerfile_Server -t lmp-splitprog:<tag> .`
3. Update image tag in `compose.yaml`
4. `docker compose down && docker compose up -d`
5. Install matching client mod zip to KSP GameData on all machines (fix Windows backslash paths with python3 zipfile)

## Known Quirks

- `End of stdin, stopping command listener` on boot — benign, no TTY in detached mode
- `Cannot deserialize this type of message!` fatal after every restart — stale UDP buffer hits the server on first startup every time; mandatory double `down && up` is the permanent workaround (see Restart procedure above)
- Toggling individual Split* flags on a live universe corrupts PlayerCareers JSON — requires universe wipe to fix

## Client Mod Locations

| Machine | Path |
|---------|------|
| LavenderTown | `/mnt/Shigawire/SteamLibrary/steamapps/common/Kerbal Space Program/GameData/LunaMultiplayer/` |
| Mac | `~/Library/Application Support/Steam/steamapps/common/Kerbal Space Program/GameData/LunaMultiplayer/` |

## Universe History

| Date | Event |
|------|-------|
| 2026-04-17 | Stack deployed |
| 2026-05-05 | Universe wiped — fresh start; split career fully disabled |
| 2026-05-08 | Universe wiped; reverts enabled; AutoDekessler set to 60 min; mod control updated; double-restart procedure documented |
