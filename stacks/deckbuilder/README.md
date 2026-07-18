# Deckbuilder ("vermilion") — PLANNED (not yet built or deployed)

> **Status: design complete, nothing deployed.** This directory holds the plan, not a running stack.
> Canonical design: **[PLAN.md](PLAN.md)** (19 sections — architecture, data sources, data model, per-screen specs, build phasing, deployment, verification).

A private, **invite-only**, self-hosted **Magic: The Gathering deck builder** (Commander-focused, Archidekt-style, **zero community surface**) for the LavenderTown homelab. React SPA (Vite + TS) → static assets served by FastAPI (Python 3.12) → PostgreSQL; one multi-stage Docker image; custom-build stack (rsync → Dockge → `build: .`), like `lavender-dashboard`/`mcp`.

## Reserved infrastructure (verify still free before deploy)

| Thing | Value |
|---|---|
| App container / port | `deckbuilder` / **8099** |
| DB container / port | `deckbuilder-postgres` / **5436** (in the `databases` stack) |
| DB data path | `/mnt/Memory Card/docker-data/deckbuilder-pg/` |
| Subdomain | `vermilion.cooldad.top` — **public, app's own login, NO Authentik** |
| Env (repo-root `.env`) | `DECKBUILDER_PG_PASS`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |

## Reference material

- **[PLAN.md](PLAN.md)** — the full design and the decisions/research behind it.
- `ref_builder_groupby_type.png`, `ref_builder_groupby_categories.png` — Archidekt "Stacks" board, same deck grouped by Type vs custom Categories (deck-builder layout north-star, PLAN §11).
- `ref_deckbuilding_template.png` — Archidekt category skeleton with target ranges (the default-on New-Deck template, PLAN §11–§12).

## When it gets built

Follow **PLAN §17 (build phasing)** and **§18 (deployment)**. The live-doc updates (root README port map / subdomains table, `lavender-dashboard/app/config.py` `STACKS`/`SUBDOMAINS`, AGENTS.md service entry) happen **at deploy time**, not before — until then this service is documented only under "Planned Services".
