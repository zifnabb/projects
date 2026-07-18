# Deckbuilder ("vermilion") — BUILD IN PROGRESS (Phases 0–4 deployed, UI pending)

> **Status (2026-07-19): backend + data core built, deployed on the server, and verified; not yet publicly proxied.**
> Phases 0–4 (scaffold · card data · search · auth · decks) are live on `deckbuilder` :8099 (server localhost only — no NPM/Cloudflare route yet). Phase 5 (the UI) is next; deploy/proxy is Phase 7.
> Canonical design: **[PLAN.md](PLAN.md)** (19 sections). Source tree: top-level [`../../deckbuilder/`](../../deckbuilder/).

A private, **invite-only**, self-hosted **Magic: The Gathering deck builder** (Commander-focused, Archidekt-style, **zero community surface**) for the LavenderTown homelab. React SPA (Vite + TS) → static assets served by FastAPI (Python 3.12) → PostgreSQL; one multi-stage Docker image; custom-build stack (rsync → Dockge → `build: .`), like `lavender-dashboard`/`mcp`.

## Build progress

| Phase | State | What |
|---|---|---|
| 0 Scaffold | ✅ deployed | FastAPI + Vite/React, multi-stage Docker, host-net `:8099` |
| 1 Card data | ✅ deployed | `deckbuilder-postgres` :5436 (pg_trgm); Alembic; Scryfall sync (38k cards / 109k printings); nightly re-sync |
| 2 Search | ✅ deployed | shared HTTP adapter + `api_cache`; Scryfall proxy + hydration; pg_trgm autocomplete; form→syntax compiler; cached rulings; card detail |
| 3 Auth | ✅ deployed | username-based invite magic-link; bcrypt + JWT cookie + `token_version`; rate-limit/lockout; admin panel API; admin bootstrap |
| 4 Decks | ✅ deployed | CRUD/clone/share, boards, format catalog + legality engine, Draft→Legal auto-tag, color-identity validation, categories + template seeding |
| 5 UI | ⏳ next | home / new-deck / builder / card panel / theming (per [DESIGN.md](DESIGN.md)) |
| 6 Header + import/export | ⏳ | legality-why, clone, share view, export text/Arena/JSON, smart importer |
| 7 Deploy | ⏳ | NPM host + Cloudflare route for `vermilion.cooldad.top`; live-doc updates |

## Infrastructure (in use on the server)

| Thing | Value |
|---|---|
| App container / port | `deckbuilder` / **8099** (host-networked) |
| DB container / port | `deckbuilder-postgres` / **5436** (in the `databases` stack) |
| DB data path | `/mnt/Memory Card/docker-data/deckbuilder-pg/` |
| Subdomain | `vermilion.cooldad.top` — **public, app's own login, NO Authentik** *(route not created yet)* |
| App env (`/root/stacks/deckbuilder/.env`) | `DECKBUILDER_PORT`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME` (=`zifnabb`), `ADMIN_PASSWORD`, `HTTP_USER_AGENT` |
| DB env (`databases` stack `.env`) | `DECKBUILDER_PG_PASS` |

Login identity is a **username** (email-free by design — see PLAN §2 decision log); admin bootstraps as `zifnabb`.

## Redeploy on the server

Custom-build pattern. From the repo root, sync the source tree and rebuild:

```bash
tar czf - -C deckbuilder --exclude=node_modules --exclude=dist --exclude=__pycache__ --exclude=.env . \
  | ssh mrfuji@diglettscave.cooldad.top "sudo rm -rf /root/stacks/deckbuilder/backend && sudo tar xzf - -C /root/stacks/deckbuilder"
ssh mrfuji@diglettscave.cooldad.top 'sudo bash -c "cd /root/stacks/deckbuilder && docker compose build"'
```

**Container replacement gotcha** (snap-Docker AppArmor blocks `docker stop`, and `restart: unless-stopped` auto-restarts on a PID-kill). Reliable swap:

```bash
docker update --restart=no deckbuilder      # stop it auto-restarting
kill -KILL <main PID>                        # sudo docker inspect -f '{{.State.Pid}}' deckbuilder
# wait until State.Status == exited, then:
docker rm deckbuilder && docker compose up -d
```

## Reference material

- **[PLAN.md](PLAN.md)** — full design + decisions/research. **[DESIGN.md](DESIGN.md)** — visual/UX system (drives Phase 5).
- `ref_builder_groupby_type.png` / `ref_builder_groupby_categories.png` — Archidekt "Stacks" board (layout north-star, PLAN §11).
- `ref_deckbuilding_template.png` — category skeleton with target ranges (PLAN §11–§12).

The remaining live-doc updates (move into the root README port map / subdomains tables, `lavender-dashboard/app/config.py` `STACKS`/`SUBDOMAINS`) happen **when it ships publicly** (Phase 7) — until then it stays under "Planned Services" so the dashboard doesn't render a phantom, unreachable service.
