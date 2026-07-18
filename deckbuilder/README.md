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
