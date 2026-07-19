# deckbuilder ("vermilion") — build context

Source for the private, invite-only MTG deck builder at `vermilion.cooldad.top`.
Canonical design + decisions live in [`../stacks/deckbuilder/PLAN.md`](../stacks/deckbuilder/PLAN.md)
and [`DESIGN.md`](../stacks/deckbuilder/DESIGN.md).

## Layout

- `backend/` — FastAPI (Python 3.12) app; serves the API under `/api` and the built SPA.
- `frontend/` — React SPA (Vite + TypeScript). Built to `dist/`, copied into the image as `./static`.
- `Dockerfile` — multi-stage: `node:22` builds the SPA → `python:3.12-slim` runtime (no Node at runtime).
- `docker-compose.yml` — `build: .`, host-networked, app on port **8099**.

## Build & run (server, via Dockge — the custom-build pattern)

This tree is rsync'd/tar'd to `/root/stacks/deckbuilder/` on LavenderTown, then
built by Dockge (Build enabled) or:

```bash
cd /root/stacks/deckbuilder && docker compose up -d --build
curl -s http://localhost:8099/api/health
```

## Local dev (optional, native)

```bash
# backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8099
# frontend (separate shell) — proxies /api to :8099
cd frontend && npm install && npm run dev   # http://localhost:5173
```

**Dev loop actually used (Mac has no local backend/Postgres):** tunnel the real
server backend and let Vite proxy to it —

```bash
ssh -o ServerAliveInterval=30 -fN -L 8099:localhost:8099 mrfuji@diglettscave.cooldad.top
cd frontend && npm run dev   # localhost:5173 → real API + card DB
```

Use Chrome/Firefox for http://localhost dev — the session cookie is `Secure`,
which Safari drops on plain-http localhost. Dev writes hit the live DB.

## Service accounts

- **`claude-qa`** (non-admin) — used by Claude for authenticated API smoke
  tests against the live site (login → scratch deck → exercise endpoints →
  delete). Password lives on the server in `/root/stacks/deckbuilder/.env`
  as `CLAUDE_QA_PASSWORD` (never committed). Deactivate it from the admin
  panel any time; recreate = mint an invite + register.

## Redeploy (server) — snap-Docker AppArmor gotcha

`docker stop` (and compose's Recreate) is blocked by AppArmor. Reliable sequence:

```bash
# 1. detached build (SSH drops kill foreground builds)
cd /root/stacks/deckbuilder && setsid nohup bash -c 'docker compose up -d --build' > rebuild.log 2>&1 &
# 2. if Recreate failed ("cannot stop container"), swap manually:
docker update --restart=no deckbuilder
kill "$(docker inspect -f '{{.State.Pid}}' deckbuilder)"   # wait for exited
docker rm -f deckbuilder && docker compose up -d
docker rename "$(docker ps -a --format '{{.Names}}' | grep '_deckbuilder$')" deckbuilder 2>/dev/null
docker update --restart=unless-stopped deckbuilder
# 3. verify the running image matches the latest build
docker inspect -f '{{.Image}}' deckbuilder ; docker images --no-trunc --format '{{.ID}}' deckbuilder-deckbuilder:latest
```
