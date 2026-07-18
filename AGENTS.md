# AGENTS.md - Project Memory & Conventions

This file captures key context, patterns, and lessons learned while working on the LavenderTown homelab.

## Server Overview (LavenderTown)
- Hostname: LavenderTown
- Access: `ssh mrfuji@diglettscave.cooldad.top` (via Cloudflare Tunnel)
- Management: Dockge (pallet.cooldad.top or :5001)
- Stack location on server: `/root/stacks/`
- All external access (web + SSH) goes through Cloudflare Tunnel (cloudflared container)

**Critical note**: The `cloudflared` container in `bigstackd` **must stay running** — it provides all external access including SSH.

## Stack Conventions
- Each stack has:
  - `docker-compose.yml`
  - `README.md` (service table, details, notes, volumes, gotchas)
- Most services use `network_mode: host`
- Custom-built images (e.g. lavender-dashboard, mcp-server) follow a specific deployment pattern (see below)
- Many stacks reference legacy external volumes from "bkstacker"

## SSH & Access Patterns
- Primary: `ssh mrfuji@diglettscave.cooldad.top`
- File transfer examples (LavenderTown):
  ```sh
  cat <local-file> | ssh mrfuji@diglettscave.cooldad.top 'sudo tee /root/stacks/.../file'
  rsync -av --delete <local-dir>/ mrfuji@diglettscave.cooldad.top:/root/stacks/<stack>/
  ```
- Nested SSH for internal boxes (e.g. terrenceb-dl):
  ```sh
  ssh mrfuji@diglettscave.cooldad.top "ssh terrenceb@10.33.22.17 '...'"
  ```
- File transfers to/from terrenceb-dl (double-hop rsync or tar pipe):
  ```sh
  # rsync (reliable for directories)
  rsync -av --delete \
    -e 'ssh -o BatchMode=yes mrfuji@diglettscave.cooldad.top ssh -o BatchMode=yes' \
    terrenceb@10.33.22.17:/media/terrenceb/mnt/testbox_home/copilot/Test-cases/ \
    ./Test-cases/

  # Tar pipe (simple pull of entire tree)
  ssh mrfuji@diglettscave.cooldad.top \
    "ssh terrenceb@10.33.22.17 'tar czf - -C /media/terrenceb/mnt/testbox_home/copilot/Test-cases .'" \
    | tar xzvf - -C Test-cases/
  ```

**Permission notes**:
- On LavenderTown: `mrfuji` cannot directly access `/root/stacks/` (Permission denied). Use `sudo` for listing/managing stacks.
- On terrenceb-dl: Direct access to user mounts like `/media/terrenceb/mnt/testbox_home/` works as the `terrenceb` user.

Always use `-o BatchMode=yes` and reasonable `-o ConnectTimeout` for non-interactive safety.

## Terrenceb-dl (Internal Test/Dev Box)
- Hostname: `terrenceb-dl`
- Internal IP: `10.33.22.17`
- Access: Always via nested SSH through LavenderTown:
  ```sh
  ssh mrfuji@diglettscave.cooldad.top "ssh terrenceb@10.33.22.17 'command here'"
  ```
- Key working area: `/media/terrenceb/mnt/testbox_home/`
  - This appears to be a mounted volume/share used for development and test-related work.
- Primary artifact: `/media/terrenceb/mnt/testbox_home/copilot/Test-cases/`
  - Contains test case enrichment, validation, and extraction work.
  - Sub-structure:
    - `data/` — candidates.json, decisions/, review/ batches, suites/ (many `suite_*_enriched.json`), zephyr_master.json
    - `tool/` — Python utilities (extract_testlink.py, extract_zephyr.py, build_candidates.py, render_batches.py, common.py, etc.)
    - Root files: findings.md, resources.md, ENRICHMENT_QUALITY_ANALYSIS.md, VALIDATION_RESULTS.md, review.html, secrets.md, .gitignore
  - `secrets.md` holds `JIRA_KEY` and `TESTLINK_DEVKEY` (used by the extraction scripts).
- **See [Test-cases/README.md](../Test-cases/README.md) for the full project framing**: The work improves Manual Test Cases (AWPTCM-Txxxx) by synthesizing Objectives from TestLink history and enriched Automated Suites, while recording many-to-one Test Suite → Manual Case mappings.
- Local mirror: The `Test-cases/` directory in this repo (`projects/Test-cases/`) is kept in sync with the remote path above.
  - Use the rsync/tar patterns documented in SSH & Access Patterns.
  - Previously treated as "ignore for homelab stack verification"; now actively maintained as a working copy.
- Typical workflow:
  1. Do heavy data extraction/enrichment/validation work on terrenceb-dl (where the keys and large datasets live).
  2. Periodically sync the `Test-cases/` tree back to the local projects repo for version control / sharing.
- Note on naming: The mount is `testbox_home` (underscore). The test work lives under a `copilot/` subfolder.

## RDP / Desktop Access (xrdp + XFCE4)
- xrdp runs directly on the host (not in a stack).
- Client: Microsoft **Windows App** (macOS) or Microsoft Remote Desktop.
- Connect to the server's LAN IP / VPN IP on **port 3389**.
  - Username: `mrfuji`
  - Cloudflare Tunnel / diglettscave does **not** carry raw RDP traffic.
- Internal: xrdp talks to sesman on 127.0.0.1:3350 (or ::1). If sesman is unreachable, `sudo systemctl restart xrdp xrdp-sesman`.
- Desktop: XFCE4 (forced X11, compositing disabled, no dpms in `~/.xsession`).
- 3389 should be listed in the root README port map.

**Note on past breakage (June 2026)**: sesman failed after `xrdp-reap-ghosts.service` ran (08:31) + `/run/xrdp` dir/perms issues on restart. Fixed by ensuring dirs + setting `ListenAddress=0.0.0.0` in `/etc/xrdp/sesman.ini` so IPv4 localhost connections succeed.

## Adding / Deploying Custom Services (Dockge + Local Builds)
For services that build locally (like lavender-dashboard and mcp-server):

1. Keep source in a top-level dir (e.g. `mcp-server/`) in this repo.
2. Create thin entry in `stacks/<name>/` (mainly `docker-compose.yml` + `README.md` for reference).
3. On server:
   - `rsync -av --delete mcp-server/ mrfuji@diglettscave.cooldad.top:/root/stacks/mcp/`
   - This ensures `build: .` works inside `/root/stacks/mcp/`
4. In Dockge: Add stack pointing to `/root/stacks/mcp/docker-compose.yml`. Enable **Build** during deploy.
5. Compose inside stack dir should use `build: .` (not relative `../../`).

**Example compose pattern** (see `stacks/mcp/docker-compose.yml` and `mcp-server/docker-compose.yml`).

## MCP Server (Added June 2026)
- Purpose: Allow local AI agents to inspect and manage homelab services/stacks via Model Context Protocol.
- Source: `mcp-server/` (FastAPI-style but uses `mcp` SDK + docker SDK)
- Tools implemented: `list_stacks`, `manage_stack` (up/down/restart/pull), `list_containers`, `get_logs`, `system_status`
- Stack definition: `stacks/mcp/`
- Usage:
  - Stdio mode preferred for MCP clients (`docker run -i` or `docker exec -i`)
  - The Dockge compose primarily manages the image definition and volumes
- Integration: Added "mcp" stack to lavender-dashboard (config.py, app.js, style.css) so it appears in the UI under "MCP / AI Tools"
- Known stacks hardcoded in `mcp-server/app/server.py`

**Deployment reminder**: After syncing, rebuild via Dockge or `docker compose up -d --build` inside the stack dir.

## Lavender-Dashboard
- FastAPI + vanilla HTML/JS/CSS (no build step)
- Collects via Docker SDK + psutil (host mounts for proc/sys/disks)
- Live updates via Server-Sent Events
- Central config in `lavender-dashboard/app/config.py` (SUBDOMAINS, STACKS, etc.)
- When adding services, update config + (if needed) frontend stack ordering/colors

## Terminal / Agent Capabilities (Observed)
- This agent can execute local bash commands in the workspace.
- SSH to LavenderTown from this machine works (key auth via tunnel).
- Full nested access to internal hosts works (most importantly `terrenceb-dl` at 10.33.22.17).
- Useful for: inspecting server state, pushing files, running remote commands via SSH, syncing work areas (Test-cases), executing scripts on internal boxes.
- Always use timeouts and non-interactive flags (`-o BatchMode=yes`, `timeout`) for safety.
- Combine with `sudo` when operating on stacks (LavenderTown). Direct user access on terrenceb-dl for its mounts.

## Planned Services (designed, not built)

- **Deckbuilder ("vermilion")** — private, invite-only, Commander-focused MTG deck builder (Archidekt-style, no community surface). React SPA (Vite+TS) + FastAPI + PostgreSQL, single multi-stage image, custom-build stack like `lavender-dashboard`/`mcp`. Source tree at top-level **`deckbuilder/`**; built on branch **`deckbuilder-build`**. Uses **port 8099** (app) / **5436** (Postgres in the `databases` stack) and subdomain **`vermilion.cooldad.top`** (public, app's own invite-only login, **no Authentik**). **Login identity is a `username`, not email** (admin bootstraps as `zifnabb`).
  - **Status: build in progress. Phases 0–4 deployed on the server + verified (2026-07-19)** — scaffold, card data (Scryfall sync 38k cards/109k printings), search (proxy + adapter + compiler), auth (username invites + JWT + admin), decks (CRUD + legality + categories + templates + share). `deckbuilder` + `deckbuilder-postgres` containers run on the server; **not yet publicly proxied** (localhost:8099 only). Phase 5 = UI (next), then header/import-export, then deploy.
  - Canonical design + decisions/research: **`stacks/deckbuilder/PLAN.md`** (19 sections; §2 has the decision log). Visual system: `stacks/deckbuilder/DESIGN.md`. Operational notes + redeploy steps: `stacks/deckbuilder/README.md`.
  - **Server redeploy gotcha:** snap-Docker AppArmor blocks `docker stop`, and `restart: unless-stopped` auto-restarts the container on a PID-kill. Reliable swap = `docker update --restart=no deckbuilder` → kill main PID → wait `exited` → `docker rm deckbuilder` → `docker compose up -d`.
  - **Still deferred to public ship (Phase 7 / PLAN §18):** NPM host + Cloudflare Tunnel route; then move it from "Planned Services" into the root README port map/subdomains tables and add `STACKS`/`SUBDOMAINS` entries in `lavender-dashboard/app/config.py`. Adding the dashboard config before it's reachable would render a phantom service.

## General Lessons & Gotchas
- Cloudflared is single point of failure for all remote access.
- For Authentik restarts: never restart the whole bigstackd stack — target only server + worker.
- LunaMultiplayer (now deprecated/removed) required double `down && up` after most changes (due to UDP buffer).
- Disk monitoring in dashboard uses specific host_mount bind points (see DISKS in config.py).
- When creating new MCP tools or collectors, mirror patterns from existing `lavender-dashboard/app/collectors/`.
- Keep stack READMEs high-quality — they are the primary operational docs.
- Local workspace (`projects/`) is a mirror; actual deploys happen on server via rsync + Dockge.
- Permission model: Prefer sudo for root-owned paths rather than changing ownership.
- xrdp/sesman on the host is somewhat fragile (reap-ghosts + /run/xrdp dirs + IPv4/IPv6 localhost bind). If sesman connect fails, the mkdir + ListenAddress=0.0.0.0 + restart sequence works.
- **Docker permission model on LavenderTown (June 2026)**: `mrfuji` + `sudo docker` frequently gets "permission denied" (could not kill container) when stopping/removing containers, even ones it started. Workaround used successfully: `pid=$(sudo docker inspect -f '{{.State.Pid}}' <ctr>); sudo kill -9 $pid; sudo docker rm -f <ctr>`. Direct `docker compose down/stop` on stacks can hit the same. Prefer compose project management via Dockge where possible; for MCP test cleanup the PID kill + rm was required.
- Stack dir writes (`/root/stacks/*`): mrfuji cannot traverse/write directly. Use `ssh ... 'sudo ...'` (tar pipe, cp, docker commands) or temp `sudo chown mrfuji ...` + operation + `sudo chown -R root ...`. Tar-over-ssh with sudo on extract is reliable for bulk syncs.
- After heavy test container creation (multiple host-net MCPs on 876x), always explicitly clean variants (`docker ps -aq --filter name=... | xargs sudo docker rm -f`) before restoring the canonical named container.
- **Terrenceb-dl file sync**: rsync with the double `-e 'ssh ... ssh ...'` works well for mirroring `Test-cases/`. Tar pipe is a simple fallback. Keep secrets.md in sync (contains JIRA + Testlink keys for the tool/ scripts).
- Test-cases work (enrichment, JIRA/Testlink/Zephyr extraction, suite validation) is primarily done on terrenceb-dl. The local copy in this repo is for versioning and sharing the scripts + data artifacts. The authoritative location is the remote `/media/terrenceb/mnt/testbox_home/copilot/Test-cases/`.
- When the user says "update the local copy" for Test-cases, perform a full rsync from terrenceb-dl (as done 2026-06-24).
- For the complete project purpose (improving AWPTCM Manual Test Cases via Objectives from TestLink + enriched ATPyLib suites, plus many-to-one mappings), see the [Test-cases/README.md](../Test-cases/README.md).

## Useful Commands (from conversation)
```sh
# Reach server
ssh mrfuji@diglettscave.cooldad.top

# Sync & deploy mcp (example)
rsync -av --delete mcp-server/ mrfuji@diglettscave.cooldad.top:/root/stacks/mcp/
ssh mrfuji@diglettscave.cooldad.top 'cd /root/stacks/mcp && docker compose up -d --build'

# Inspect stacks
ssh mrfuji@diglettscave.cooldad.top 'sudo ls /root/stacks/'

# RDP test (after fixing sesman)
# (use Windows App / RDP client to <server-ip>:3389 as mrfuji)

# Cleanup stray test containers (example from MCP test cycle)
ssh mrfuji@diglettscave.cooldad.top '
  IDS=$(sudo docker ps -aq --filter "name=lavender-mcp");
  for id in $IDS; do
    pid=$(sudo docker inspect --format "{{.State.Pid}}" $id 2>/dev/null || echo 0);
    [ "$pid" != "0" ] && sudo kill -9 $pid || true;
  done;
  sudo docker ps -aq --filter "name=lavender-mcp" | xargs -r sudo docker rm -f;
  sudo docker rm -f satisfactory 2>/dev/null || true;  # (full Satisfactory + LMP images+dirs later purged July 2026)
'
# Refresh + restart canonical MCP (note full -f path)
ssh mrfuji@diglettscave.cooldad.top '
  sudo docker compose -f /root/stacks/mcp/docker-compose.yml down --remove-orphans;
  sudo docker compose -f /root/stacks/mcp/docker-compose.yml up -d --build;
'
# Verify
ssh mrfuji@diglettscave.cooldad.top 'sudo docker ps --filter "name=lavender-mcp" --format "{{.Names}} {{.Status}}"; sudo ss -tlnp | grep 8765'

# Reach terrenceb-dl (internal test box)
ssh mrfuji@diglettscave.cooldad.top "ssh terrenceb@10.33.22.17 'hostname; whoami; pwd'"

# Inspect Test-cases on terrenceb-dl
ssh mrfuji@diglettscave.cooldad.top "ssh terrenceb@10.33.22.17 'ls -la /media/terrenceb/mnt/testbox_home/copilot/Test-cases/'"

# Sync Test-cases from terrenceb-dl to local (recommended)
rsync -av --delete \
  -e 'ssh -o BatchMode=yes mrfuji@diglettscave.cooldad.top ssh -o BatchMode=yes' \
  terrenceb@10.33.22.17:/media/terrenceb/mnt/testbox_home/copilot/Test-cases/ \
  ./Test-cases/

# Quick tar-based pull (if rsync is finicky)
ssh mrfuji@diglettscave.cooldad.top \
  "ssh terrenceb@10.33.22.17 'tar czf - -C /media/terrenceb/mnt/testbox_home/copilot/Test-cases .'" \
  | tar xzvf - -C Test-cases/
```

Update this file when new patterns, gotchas, or services are added.

## Verification Findings (June 2026)
After exhaustive review of all files:

**Note on Test-cases/**: This directory (both locally and on remote) was previously ignored during homelab stack verification because it is separate test/enrichment tooling rather than part of the Docker stacks. It is now actively synced and documented (see "Terrenceb-dl and Test Work" section and [Test-cases/README.md](../Test-cases/README.md) for full framing). When reviewing homelab docs, you can still focus on stacks/, lavender-dashboard/, mcp-server/, and root files, but Test-cases/ is a first-class mirror of work done on terrenceb-dl.

- Most documentation is accurate and consistent with compose files, source code, and stack READMEs.
- Key updates made to resolve inaccuracies:
  - Updated `lavender-dashboard/app/config.py` SUBDOMAINS:
    - Fixed `celadon` from stale "Homepage" (container "homepage", stack "infra") to current "LavenderTown Dashboard" (container "lavender-dashboard", stack "lavender-dashboard").
    - Updated Piped-era entries for `rocketcorner`/`rockethideout` to current Invidious/Invidious Companion (matching media stack and root README). Removed outdated `silphco` (Piped) entry as it is no longer reflected in root subdomains or media docs.
  - Clarified root `README.md` "Each stack directory contains" section (historical): not all stacks have docker-compose.yml locally (lunamultiplayer used compose.yaml on server at the time; custom builds like lavender-dashboard/mcp keep source in sibling dirs).
  - Updated `mcp-server/app/server.py` KNOWN_STACKS to include "mcp" and "system" (and later removed the deprecated lunamultiplayer entry).
- Root README subdomains table now matches updated config and media stack (after fixes).
- Dashboard code (main.py, collectors, compose) and mcp implementation fully match their docs.
- Lunamultiplayer (deprecated/removed July 2026): local mirror dir retained with archived README for history; no compose on server or in active use.
- No other major contradictions found. Some runtime container names (e.g. "dockge-dockge-1") differ from compose but are expected.
- AGENTS.md itself was created/updated during this process to capture lessons.
- Test-cases/ directory is a synced mirror of remote work on terrenceb-dl (see dedicated section above). It is no longer blindly ignored during reviews when relevant context is needed.

### MCP Test Cleanup (2026-06-24)
During the final phase of MCP server repairs (per-service tools, dry_run, force, plan_action) and Invidious-style stop/start tests:
- ~12+ stray `lavender-mcp-*` containers existed (named with -old, -new, -test, -test2, -final*, -repaired*, -repair* suffixes) from repeated `docker run` + port 8765-9 tests.
- 5 TCP listeners on 8765-8769 (python/uvicorn from the HTTP transport tests).
- A leftover `satisfactory` container (`wolveix/satisfactory-server`, Created) + `/root/stacks/satisfactory/` stack dir (compose.yaml + data + backup) were also present (June 2026).
- All test MCP containers + the satisfactory container were removed at that time.
- **Full deprecation (2026-07-02)**: Remaining Satisfactory images + the `satisfactory` container (re-created) + entire stack dir purged; all LMP images (`lmp-splitprog:*` variants) + any associated state also removed. Both marked deprecated in docs.
- Source in `/root/stacks/mcp/` was refreshed with current code from the workspace.
- The canonical `lavender-mcp` was (re)started fresh via the managed compose on **port 8765 only**.
- See `stacks/mcp/README.md` (Cleanup History section) for the exact container list, commands, and verification output.
- Evidence: post-clean `docker ps` shows only `lavender-mcp`; `ss` shows only 8765; no satisfactory container.

## MCP Server Functionality (Plan & Current Implementation)
The MCP server (in `mcp-server/`, deployed via `stacks/mcp/`) exposes a set of tools over the Model Context Protocol. Its primary goal is to let a **local AI agent** (running via Claude Desktop, Cursor, Continue.dev, custom agents, etc.) inspect, diagnose, and operate the homelab without requiring the human to use SSH or the Dockge UI directly.

### Current Implemented Tools
- **`list_stacks`**: Returns a summary of all known stacks (from KNOWN_STACKS + dynamically discovered via `com.docker.compose.project` labels). Includes total containers and how many are "running".
- **`manage_stack`**: Performs lifecycle actions on a named stack (or specific service):
  - Supports optional `service` param for per-service control.
  - `up` / `down` / `restart` / `pull`
  - `dry_run: true` for preview (uses --dry-run).
  - `force: true` required for destructive actions (down/restart) unless dry_run.
- **`restart_service` / `stop_service` / `start_service`**: Dedicated per-service control tools with the same dry_run/force safety.
- **`plan_action`**: Safe preview tool. Always returns a description of what would happen without making changes (recommended first step for any write operation).
- **`list_containers`**: Lists containers (name, stack, image, status). Can be filtered by stack.
- **`get_logs`**: Returns the last N lines of logs (with timestamps) from a specific container. Output is truncated for practicality.
- **`system_status`**: Lightweight host metrics (CPU %, memory used/total, disk). (Updated to include basic disk usage.)

Safety/approval handling is integrated directly into the tools:
- Destructive actions (down/restart/stop) refuse unless `force=true` (or `dry_run=true` first).
- New `plan_action` tool lets the agent review the exact effect safely before any execution.
- The calling LLM/agent is expected to present a plan and use `plan_action` before force-applying changes.

### How It Enables AI Operation
- **Read / Observe**: The AI can ask questions like "What's the health of the media stack?" or "Show me recent logs from jellyfin" and get structured answers.
- **Act / Control**: The AI can perform real operations: "Pull updates and restart the databases stack."
- **Context-Aware**: It understands this specific homelab's stack names, paths (`/root/stacks`), and compose project labels.
- **Transport**: Primarily stdio (standard for MCP clients). A containerized version exists mainly for image management and to provide the docker.sock + stacks mounts.

### Architecture & Deployment Notes
- Docker client via mounted socket.
- Compose operations via subprocess (for full feature support).
- Runs with access to the full set of stacks defined in the homelab.
- Designed to be used via `docker run -i` (stdio) or `docker exec -i` from the MCP client.
- Security: Extremely powerful (full Docker + compose control). Should only be exposed to trusted local agents.

### Potential / Future Functionality (if expanded)
- More diagnostic tools (container stats, inspect, health checks).
- Service-level control (restart individual containers/services).
- Read-only compose file inspection or diff.
- Integration with lavender-dashboard APIs for richer topology/metrics.
- Approval / "dry-run" mode before executing destructive actions (`down`, `restart`).
- HTTP / SSE transport for remote (but secured) AI clients.
- Notification or logging of actions taken by the AI.
- Volume, network, or image management tools.
- Safer execution (run compose commands with limited privileges).

This turns the homelab into something an LLM can meaningfully "operate" — moving from passive monitoring (lavender-dashboard) to active agent-driven management.

## Local AI Agents Compatible with This MCP Server (Plan)

The MCP server is designed primarily for **local** AI agents using the stdio transport (the current default and most mature MCP connection method).

### Currently Best Supported Clients

These can directly use the MCP server today via stdio:

- **Claude Desktop** (Anthropic)
  - The most mature and easiest MCP client right now.
  - Configure in `claude_desktop_config.json`.
  - Recommended starting point for using the homelab tools.

- **Cursor** (AI-first code editor)
  - Strong MCP support.
  - Good if you want the AI to also help with code/config changes alongside homelab ops.

- **Continue.dev** (open-source autopilot)
  - Works inside VS Code and JetBrains IDEs.
  - Very flexible for custom agent setups.
  - Can be pointed at your homelab MCP for "devops agent" workflows.

- **Goose** (by Block)
  - General-purpose AI agent that supports MCP servers.

- **Other emerging tools** (as of 2026):
  - Windsurf
  - Various VS Code extensions with MCP support
  - Any client built with the official MCP SDKs

### Configuration Pattern (stdio)

Most clients use a config like this:

```json
{
  "mcpServers": {
    "lavender-homelab": {
      "command": "docker",
      "args": [
        "exec",
        "-i",
        "lavender-mcp",
        "python",
        "-m",
        "app.server"
      ]
    }
  }
}
```

Alternative (if you don't keep the container running constantly):

```json
{
  "mcpServers": {
    "lavender-homelab": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "/var/run/docker.sock:/var/run/docker.sock",
        "-v", "/root/stacks:/stacks:ro",
        "lavender-mcp:latest"
      ]
    }
  }
}
```

### Fully Local / Self-Hosted LLM Options

Currently more limited because most polished MCP frontends are tied to Claude or commercial tools:

- **Custom agents** (best option today):
  - Write a small Python script using the `mcp` client library + Ollama / llama.cpp / LM Studio.
  - Gives you full control and keeps everything local.

- **Future possibilities**:
  - When open-source local MCP hosts become available (similar to Claude Desktop but 100% local).
  - Bridges that expose Ollama models through an MCP-compatible interface.

### MCP Access for Other LLMs and Custom Agents

The MCP server is accessible over HTTP (current deployment) on port 8765.

**To connect from any MCP-compatible client or other LLMs (e.g. via Continue.dev + local models):**

1. **Establish SSH tunnel** from your local machine (this is the secure way within the homelab constraints):
   ```bash
   ssh -L 8765:localhost:8765 mrfuji@diglettscave.cooldad.top
   ```
   (Keep the tunnel open while using the agent.)

2. **Configure the client** to use `http://localhost:8765` as the MCP server URL.

**Example for Continue.dev (works excellently with local Ollama/LM Studio models):**

Add this to your Continue `config.json`:

```json
{
  "mcpServers": {
    "lavender-mcp": {
      "url": "http://localhost:8765"
    }
  }
}
```

Then select a local model and ask it to use tools like "list the current homelab stacks" or "restart the media stack".

**For fully custom agents (any LLM):**

Use the official `mcp` Python client library:

```python
import asyncio
from mcp.client import Client

async def main():
    # After SSH tunnel is active
    async with Client("http://localhost:8765") as client:
        tools = await client.list_tools()
        print("Available tools:", [t.name for t in tools])

        # Example tool call
        result = await client.call_tool("list_stacks", {})
        print(result)

asyncio.run(main())
```

This works with any backend (Ollama, Groq, local GGUF, etc.) as long as your agent framework can call the MCP client.

**Alternative stdio access (no tunnel needed for the connection itself):**

Configure clients to run the server via SSH + docker exec (see earlier sections in this file for examples).

**Security note:** The MCP tools give near-root control over Docker and the stacks. Always use the SSH tunnel (or NPM + Authentik if exposing a subdomain), and consider adding human-in-the-loop approval for write operations like `manage_stack`.

See the full connection examples and deployment details in `stacks/mcp/README.md`.

### Recommendations for This Homelab

1. **Start here**: Claude Desktop + the MCP server. Fastest way to get an AI that can manage your stacks.
2. If you want everything local: Build a thin custom agent on top of Ollama + the MCP client SDK.
3. For development workflows: Cursor or Continue.dev work very well alongside the homelab MCP.
4. **Planned improvement**: Implement the HTTP/SSE (or streamable HTTP) transport in the MCP server. This would allow:
   - Easier connection from any machine on your LAN.
   - More flexible agent setups (including some local LLM frontends).
   - Potential secure exposure behind Authentik (not recommended without strong safeguards).

The MCP server gives local AI "eyes and hands" on your Docker homelab. Choose the client based on whether you prioritize Claude's capabilities, full local models, or IDE integration.

### Free vs Paid Options (as of 2026)

**Completely Free / Open Source:**
- **Continue.dev**: Fully free and open-source. Excellent choice for local models (Ollama, etc.).
- **Goose** (Block): Open-source and free to run locally.
- **Custom Python agents**: 100% free. You control everything (model, logic, safety).

**Free Tier with Limits:**
- **Claude Desktop**: Free to use with Anthropic's free tier (rate limits apply; Pro removes most limits).

**Paid / Freemium:**
- **Cursor**: Free tier exists but is limited. Pro (~$20/mo) is needed for heavy/unlimited use.
- **Windsurf** and similar newer tools: Usually have generous free tiers but push paid plans for advanced features.

### Python Agent vs Full LLM Interaction

**Using a full LLM client** (Claude Desktop, Cursor, Continue with good model):
- Natural language interaction ("The Jellyfin container is using too much CPU, diagnose and fix it").
- The model can autonomously decide which tools to call, in what order, and interpret results.
- Strong reasoning, planning, and multi-step tool use.
- Best "agentic" experience today.

**Using a custom Python agent** (your own script + MCP client + Ollama/local model):
- More deterministic and auditable.
- You can add hard safety rails (e.g., never allow `down` without explicit confirmation, rate limiting, logging every action).
- Interaction styles you can build:
  - Simple CLI: `python homelab-agent.py "restart databases"`
  - Scheduled monitor: Runs every 5 minutes, uses tools, and only acts on clear problems.
  - Mini web UI (FastAPI + nice frontend) that talks to local LLM + your MCP tools.
  - Rule-based + LLM hybrid: Python handles safety and known patterns; LLM only used for complex diagnosis.
- Weaker reasoning than Claude 4 / GPT-4o class models unless you use a very strong local model + excellent prompting.

**Recommendation for this homelab:**
- Start with **Continue.dev** (free + local-friendly) or **Claude Desktop** (best intelligence).
- Later build a custom Python agent if you want full control, auditing, or to run everything 100% offline with Ollama.

Last updated: 2026-06-24 (added terrenceb-dl / Testbox-home / Test-cases details, nested rsync patterns, expanded SSH + lessons from recent sessions)

## PLAN: Expanding HTTP/SSH Connections to the MCP Server

**Goal**: Allow local AI agents to connect to the MCP server over HTTP (web transport) and improve/expand SSH-based connections, while strictly respecting homelab constraints.

### Current State
- MCP server is stdio-only (MCP_TRANSPORT=stdio).
- Primary usage: `docker run -i` or `docker exec -i lavender-mcp python -m app.server`
- Compose uses `network_mode: host`, mounts docker.sock + /root/stacks (ro).
- No public HTTP endpoint.
- SSH access exists via `mrfuji@diglettscave.cooldad.top` (Cloudflare Tunnel, key-based).
- All web traffic goes through Cloudflare Tunnel → NPM (infra) → optional Authentik forward auth.
- High-privilege service (full Docker/compose control) → strong security required.

### Key Homelab Constraints
- No direct internet exposure; everything via existing cloudflared tunnel.
- Web services proxied by NPM (can add subdomains or paths).
- SSH is special-cased (diglettscave subdomain, no Authentik).
- Prefer `network_mode: host` or minimal port exposure.
- Compose files managed in `/root/stacks/<name>/` (synced from local source for custom builds).
- Authentik + NPM for protected web endpoints.
- Dockge for stack lifecycle.
- Powerful access must not be casually exposed.

### Recommended Expansion Strategy

#### Phase 1: Implement HTTP Transport (Code + Container)
- Update `mcp-server/app/server.py`:
  - Support `MCP_TRANSPORT=http` (or `sse` / `streamable-http` per current MCP spec).
  - Use MCP SDK's HTTP server support (typically involves `uvicorn` + Starlette/FastAPI adapter or `mcp.server.streamable_http`).
  - Add env vars: `MCP_HOST=0.0.0.0`, `MCP_PORT=8765`, etc.
  - Keep stdio as default for backward compat.
- Update `mcp-server/Dockerfile` and `requirements.txt`:
  - Add `uvicorn`, `starlette` (or whatever the SDK requires for HTTP).
  - Make CMD flexible based on transport env.
- Update `stacks/mcp/docker-compose.yml`:
  - Add port mapping if not relying on host mode (or document host binding).
  - Set `MCP_TRANSPORT=http` and the port for the HTTP variant (keep a stdio reference compose? or use profiles).
  - Document two modes.

#### Phase 2: SSH-Based Connections (Leverage Existing)
This is the lowest-friction way to "expand" without new exposure.

**Stdio over SSH (recommended for power users):**
- MCP client config example:
  ```json
  {
    "mcpServers": {
      "lavender-mcp": {
        "command": "ssh",
        "args": [
          "-o", "BatchMode=yes",
          "-o", "StrictHostKeyChecking=accept-new",
          "mrfuji@diglettscave.cooldad.top",
          "docker", "exec", "-i", "lavender-mcp",
          "python", "-m", "app.server"
        ]
      }
    }
  }
  ```
- Works today (once HTTP is implemented, can still prefer this for stdio).

**HTTP over SSH tunnel:**
- `ssh -L 8765:localhost:8765 mrfuji@diglettscave.cooldad.top`
- Point MCP client to `http://localhost:8765`
- Or use autossh for persistent tunnel.
- Keeps everything inside existing SSH auth.

#### Phase 3: HTTP via NPM + Authentik (for convenience)
- Choose a port (e.g. 8765) and subdomain (e.g. `mcp.cooldad.top` or reuse an internal one).
- In the mcp compose: bind the HTTP server (network_mode: host makes `localhost:8765` on server reachable).
- In NPM (via Dockge or NPM UI):
  - Create proxy host for `mcp.cooldad.top` → `192.168.1.222:8765` (or localhost if same host).
  - Enable **Authentik Forward Auth**.
- Update Cloudflare Tunnel (if subdomain not already covered).
- Add to root `README.md` port map and subdomains table.
- Optionally surface in lavender-dashboard (add to SUBDOMAINS with "auth": true, but mark carefully or put in INTERNAL_SERVICES + NO_LINK because of privilege level).
- Client config: point to `https://mcp.cooldad.top`

**Alternative**: Path-based proxy under an existing protected subdomain (e.g. under pewter or a tools subdomain) to avoid new DNS entry.

### Security Guidelines (Non-Negotiable)
- **Never** expose the MCP HTTP endpoint without Authentik forward auth.
- Prefer stdio-over-SSH for day-to-day trusted local agents.
- Consider additional protections:
  - IP allowlisting in NPM if possible.
  - Future: add simple bearer token or API key validation inside the MCP server.
  - Logging of all tool calls.
  - "Dry-run" or approval mode for write operations (manage_stack).
- Document clearly that this gives near-root Docker access.

### Implementation Order & Files to Touch
1. **mcp-server/app/server.py** + **requirements.txt** + **Dockerfile** — add real HTTP support.
2. **stacks/mcp/docker-compose.yml** — support HTTP mode + port docs.
3. **stacks/mcp/README.md** — update "Build & Deploy", add "Connecting over HTTP/SSH" section with examples.
4. **README.md** (root) — add entry in port map and subdomains table if using new subdomain.
5. **lavender-dashboard/app/config.py** — optional (for visibility in topology).
6. **AGENTS.md** — record the plan and chosen approach.
7. Test:
   - Local stdio still works.
   - SSH tunnel + HTTP.
   - Full NPM + Authentik path.
   - At least one client (Continue.dev or Claude Desktop) using the new transport.

### Open Questions / Trade-offs
- Exact port? (avoid conflicts with 808x, 9000 range, etc.)
- New subdomain (`mcp.cooldad.top`) vs path-based?
- Keep the container in "stdio" mode by default and document a second compose or env override for HTTP?
- Should the MCP container run with a non-root user inside for reduced blast radius?

This approach adds HTTP/SSH flexibility while reusing every existing piece (tunnel, NPM, Authentik, SSH, Dockge, compose sync process) and maintaining the "powerful but carefully exposed" philosophy. 

Start with Phase 1 (HTTP code) + Phase 2 (SSH patterns) before touching NPM.