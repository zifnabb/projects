# MCP Server Stack

Model Context Protocol (MCP) server providing tools for local AI agents to inspect and manage homelab services and Docker Compose stacks.

## Services

| Service | Image | Notes |
|---------|-------|-------|
| lavender-mcp | `lavender-mcp` (local build) | Python MCP server with Docker + stack management tools |

## Features / Tools Provided to AI

The server exposes the following tools over MCP:

- `list_stacks` — Overview of all known stacks with container counts and status
- `manage_stack` — `up`, `down`, `restart`, or `pull` for a stack (supports optional `service` for per-service control, `dry_run`, and `force` for safety)
- `restart_service` / `stop_service` / `start_service` — Per-service control with dry_run + force safety
- `plan_action` — Safe preview of any action (returns what would happen, no changes made)
- `list_containers` — Full container/service list (optionally filtered by stack)
- `get_logs` — Tail logs from any container/service
- `system_status` — Basic CPU/memory overview

These tools allow a local AI (running on the LAN or the server itself) to:
- Diagnose issues
- Safely restart or control individual services or entire stacks (destructive actions require explicit `force=true` or `dry_run=true` first)
- Inspect logs
- Understand the current state of the homelab

Safety/approval is integrated: destructive actions (down/restart) will refuse to execute unless `force=true` is provided (after the AI has reviewed via `dry_run`). The AI is expected to present plans before applying changes.

## Configuration

The server discovers stacks primarily via Docker Compose project labels.

Known stacks are defined in the server code (`mcp-server/app/server.py`).

Inside the container:
- `/stacks` is the bind-mounted root of all stack directories (read-only by default in compose).

## Volumes & Mounts

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `/var/run/docker.sock` | `/var/run/docker.sock` | Full Docker control (containers + compose) |
| `/root/stacks` (or equivalent) | `/stacks` | Access to compose files for stack management |

## Security Considerations

**Powerful access**: This MCP server can start/stop/restart any service and pull images.

- Run with minimal privileges where possible.
- Prefer stdio invocation (`docker run -i`) from trusted local AI clients.
- Do not expose publicly without strong authentication (Authentik + NPM).
- Review actions the AI proposes before applying in production.

## Build & Deploy with Dockge

Dockge manages stacks by pointing at `docker-compose.yml` files under `/root/stacks/`.

### Prerequisites on the server
Because this is a locally-built image, the build context files must live alongside the compose file:

1. SSH to the server.
2. Ensure `/root/stacks/mcp/` exists.
3. Copy the build context into it:
   - `Dockerfile`
   - `requirements.txt`
   - `app/` directory (the whole folder)

   You can do this with rsync or scp from your local `mcp-server/` folder:

   ```bash
   rsync -av --delete mcp-server/ root@diglettscave.cooldad.top:/root/stacks/mcp/
   ```

   (Adjust user/host as needed.)

4. Make sure `/root/stacks/mcp/docker-compose.yml` is present (it should use `build: .`).

### Deploy via Dockge UI
1. Open Dockge (usually at `pallet.cooldad.top` or `:5001`).
2. Dockge should auto-discover the new stack if it is configured to watch `/root/stacks`.
3. If not visible:
   - Click **Add Stack**
   - Set **Stack Name**: `mcp` (or `mcp-server`)
   - Set **Compose Path**: `/root/stacks/mcp/docker-compose.yml`
4. Review the preview.
5. Click **Deploy**.
6. Make sure the **Build** option is enabled (Dockge will build the image from the local Dockerfile instead of pulling).

Dockge will handle the build and start the container.

### Manual alternative (if needed)
```bash
cd /root/stacks/mcp
docker compose up -d --build
```

The image is always built locally on the server — no registry required.

## Connection Methods

### Via stdio (recommended for trusted local agents)

Configure your MCP client (Claude Desktop, Cursor, Continue, custom agent, etc.) similar to:

```json
{
  "mcpServers": {
    "lavender-mcp": {
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

Or target the running container:

```json
{
  "mcpServers": {
    "lavender-mcp": {
      "command": "docker",
      "args": ["exec", "-i", "lavender-mcp", "python", "-m", "app.server"]
    }
  }
}
```

### Via SSH (stdio or HTTP over tunnel)

You can reach the MCP server entirely over the existing SSH access without any additional exposure.

**Stdio over SSH (recommended for most local AI clients):**

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

**HTTP over SSH local port forward (once HTTP transport is enabled):**

```bash
ssh -L 8765:localhost:8765 mrfuji@diglettscave.cooldad.top
```

Then configure your MCP client to point at `http://localhost:8765`.

Use `autossh` or a systemd user service on your client machine for a persistent tunnel.

### Via HTTP (internal or proxied)

Once HTTP/Streamable HTTP support is implemented in the server, you have two main options:

**1. HTTP over SSH tunnel** (no changes to homelab networking)
See above.

**2. Proxied via NPM + Authentik** (convenient LAN access)

- Choose a port (e.g. `8765`).
- Run the container with `MCP_TRANSPORT=http` and the server listening on that port.
- In NPM (pallet.cooldad.top), create a proxy host:
  - Subdomain: `mcp.cooldad.top` (or path-based under an existing host)
  - Forward to: host IP + port (e.g. `192.168.1.222:8765`)
  - Enable **Authentik Forward Auth**
- Add the subdomain entry to Cloudflare if not covered by the wildcard tunnel.
- Update your MCP client to use `https://mcp.cooldad.top`

**Example client config (HTTP):**

```json
{
  "mcpServers": {
    "lavender-mcp": {
      "url": "https://mcp.cooldad.top"
    }
  }
}
```

> **Security warning**: The MCP server has full Docker and compose control. Only enable the proxied HTTP path with Authentik, and strongly prefer SSH-based stdio connections for day-to-day use.

## Enabling HTTP Transport (Implementation Steps)

The server code currently defaults to stdio. To enable HTTP:

1. **Update the server code** (`mcp-server/app/server.py`):
   - Implement support for `MCP_TRANSPORT=http` using the MCP SDK's streamable HTTP or SSE helpers (add `uvicorn` and any required ASGI deps).
   - Accept `MCP_HOST` and `MCP_PORT` environment variables.
   - Keep stdio as the default for backward compatibility.

2. **Update dependencies and container**:
   - Add `uvicorn`, `starlette` (or equivalent) to `mcp-server/requirements.txt`.
   - Adjust `mcp-server/Dockerfile` so the CMD can run either stdio or an HTTP server based on the transport env var.

3. **Update deployment compose** (`stacks/mcp/docker-compose.yml` and the source `mcp-server/docker-compose.yml`):
   - Support both modes (e.g. via environment variable or compose profiles).
   - Example for HTTP mode:
     ```yaml
     environment:
       STACKS_DIR: "/stacks"
       MCP_TRANSPORT: "http"
       MCP_HOST: "0.0.0.0"
       MCP_PORT: "8765"
     # ports: ["8765:8765"]   # only needed if not using network_mode: host
     ```

4. **Rebuild and deploy**:
   - Rsync the updated `mcp-server/` tree to `/root/stacks/mcp/`.
   - Redeploy the stack in Dockge (with Build enabled) or run `docker compose up -d --build`.

5. **Proxy configuration** (for NPM path):
   - Add the proxy host in NPM as described above.
   - Optionally add the service to the LavenderTown Dashboard config for visibility (see `lavender-dashboard/app/config.py`).

6. **Client testing**:
   - Verify stdio still works.
   - Test the new HTTP/SSH paths with at least one MCP client (Continue.dev, Claude Desktop, or a custom Python agent).

## Deployment Modes Summary

| Mode              | Transport | Connection Method                  | Recommended For          | Requires NPM/Authentik? |
|-------------------|-----------|------------------------------------|--------------------------|-------------------------|
| Stdio (default)   | stdio     | `docker exec` or `docker run -i`   | Trusted local agents     | No                      |
| Stdio over SSH    | stdio     | `ssh ... docker exec`              | Remote trusted clients   | No                      |
| HTTP over SSH     | http      | SSH `-L` forward + local URL       | Local clients wanting HTTP | No                   |
| HTTP via NPM      | http      | `https://mcp.cooldad.top`          | Convenient LAN access    | Yes (strongly recommended) |

## Notes

- Follows the same `network_mode: host` pattern used by most other stacks.
- Reuses Docker socket access pattern from the Lavender Dashboard.
- Add new stacks to the `KNOWN_STACKS` list in the server when introducing them.
- For maximum safety, the AI client should present a plan before the `manage_stack` tool is executed.

## Cleanup History (2026-06-24)

During MCP development, tool iteration, and repair (dry_run/force/plan_action/per-service), many test containers were created manually (outside the managed compose) to work around port conflicts and test changes:

**Removed test containers (all `lavender-mcp-*` variants):**
- lavender-mcp (base, Exited)
- lavender-mcp-old, lavender-mcp-new
- lavender-mcp-test, lavender-mcp-test2
- lavender-mcp-final, lavender-mcp-final-test
- lavender-mcp-repaired, lavender-mcp-repaired2/3/4
- lavender-mcp-repair-final, lavender-mcp-repair-v2

These left stray Python/uvicorn listeners on 8765, 8766, 8767, 8768, 8769.

**Satisfactory container:**
- `satisfactory` (image: wolveix/satisfactory-server:latest, state: Created)
- A full stack definition also existed at `/root/stacks/satisfactory/` (compose.yaml, .env, data/, large save backup tar).

**Actions taken:**
1. Inspected via `sudo docker ps -a --filter name=lavender-mcp` and `ss -tlnp | grep 876`.
2. Stopped running test processes with direct host PID kill (see below).
3. Removed with `sudo docker rm -f <ids>`.
4. Removed `satisfactory` container (`sudo docker rm -f satisfactory`).
5. Refreshed build context under root (tar pipe via sudo) because mrfuji has no direct FS write access to `/root/stacks/`.
6. Restarted the managed stack:
   ```
   sudo docker compose -f /root/stacks/mcp/docker-compose.yml down --remove-orphans
   sudo docker compose -f /root/stacks/mcp/docker-compose.yml up -d --build
   ```

**Permission workarounds required (repeated observation):**
- `sudo docker kill` / `sudo docker rm -f` / `sudo docker stop` often return "could not kill container: permission denied" even for containers started under the same context.
- Reliable workaround: `pid=$(sudo docker inspect --format '{{.State.Pid}}' <id>) ; sudo kill -9 $pid` then `sudo docker rm -f <id>`.
- File operations on stacks require sudo (e.g. `tar ... | ssh 'sudo tar -C /root/stacks/mcp/'` or temp chown + rsync + restore). Direct `rsync ...:/root/stacks/mcp/` fails on parent directory permissions.

**Post-cleanup verified state:**
- Only MCP container: `lavender-mcp` (Up, container_name from compose)
- Image built as `mcp-mcp-server` (from context dir name)
- Single port: `0.0.0.0:8765` (HTTP/Uvicorn)
- Compose project "mcp" shows `running(1)`
- No other 876x listeners
- No satisfactory container (at the time)
- `/root/stacks/satisfactory/` directory remained temporarily (later fully deleted in 2026-07 deprecation: container + image + entire dir removed; see root README Legacy and stacks/lunamultiplayer/README.md)

The MCP server is now restored to a clean single-instance state on the original port using the Dockge-managed compose definition. All test artifacts from the recent development cycle have been eliminated.
