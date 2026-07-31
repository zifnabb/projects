# Deckbuilder ("vermilion") — LIVE

> **Status (2026-07-30): shipped. All phases 0–7 complete; the first live-feedback polish pass is done.**
> Public at **[vermilion.cooldad.top](https://vermilion.cooldad.top)** (invite-only, app's own login, no Authentik).
> Canonical design: **[PLAN.md](PLAN.md)** (19 sections) · visual system: **[DESIGN.md](DESIGN.md)** · source tree + dev/redeploy: [`../../deckbuilder/`](../../deckbuilder/).

A private, **invite-only**, self-hosted **Magic: The Gathering deck builder** (Commander-focused, Archidekt-style, **zero community surface**) for the LavenderTown homelab. React SPA (Vite + TS) → static assets served by FastAPI (Python 3.12) → PostgreSQL; one multi-stage Docker image; custom-build stack (tar → Dockge → `build: .`), like `lavender-dashboard`/`mcp`.

## Build progress

| Phase | State | What |
|---|---|---|
| 0 Scaffold | ✅ | FastAPI + Vite/React, multi-stage Docker, host-net `:8099` |
| 1 Card data | ✅ | `deckbuilder-postgres` :5436 (pg_trgm); Alembic (at `0004`); Scryfall sync (38k cards / 109k printings); nightly re-sync |
| 2 Search | ✅ | shared HTTP adapter + `api_cache`; Scryfall proxy + hydration; pg_trgm autocomplete; form→syntax compiler; cached rulings; card detail |
| 3 Auth | ✅ | username-based invite magic-link; bcrypt + JWT cookie + `token_version`; rate-limit/lockout; admin panel API; admin bootstrap |
| 4 Decks | ✅ | CRUD/clone/share, boards, format catalog + legality engine, Draft→Legal auto-tag, color-identity validation, categories + template seeding |
| 5 UI | ✅ | auth screens · home dashboard + unified Cards↔Decks search · New Deck modal · builder (Stacks/List/Grid, group-by Categories⇄Type, quick-add, drag-and-drop, Search rail, card detail panel, stats sidebar) · account + admin screens |
| 6 Header + import/export | ✅ | legality-why, clone, Private/Shared + share link, export text/Arena/JSON, smart importer (paste/CSV/JSON/Archidekt + Moxfield URL), `/shared/<token>` read-only view |
| 7 Deploy | ✅ | NPM host + Cloudflare route for `vermilion.cooldad.top`; root README + `lavender-dashboard` config updated |
| Feedback pass 1 | ✅ | MDFC/DFC render + flip in all views · Grid view = real grid · List/Stacks masonry packing · printing change drives board art (incl. per-printing `card_faces`) · Game Changer chips · Savage-Lands name-collision resolve · quick-add legality + color-identity filter · category manager UI |

## What's next

1. **Stats sidebar v2** — spec'd in [PLAN §11](PLAN.md) ("Stats sidebar"): view-switcher rail (Condensed / Colors / Mana Curve / Probability / Quantities) + pin/unpin + a Cost & Production options menu. First substantial feature post-MVP.
2. **Synergy tab** — the app's signature surface, full spec in PLAN §14 (5 free/offline lanes first, then otag-function, Combos, EDHREC-similar, Budget).
3. **Pricing**, EDHREC/Combos/Landbase tabs, auto-tagging — PLAN §16.

**Out of scope for good:** deck grading (salt/bracket/power), undo/version history, playtester/goldfish, all social/community surface.

## Infrastructure (in use on the server)

| Thing | Value |
|---|---|
| App container / port | `deckbuilder` / **8099** (host-networked) |
| DB container / port | `deckbuilder-postgres` / **5436** (in the `databases` stack) |
| DB data path | `/mnt/Memory Card/docker-data/deckbuilder-pg/` |
| Subdomain | `vermilion.cooldad.top` — public, app's own login, **no Authentik** |
| Cloudflare Tunnel route | `vermilion` → `http://localhost:80` (plain HTTP into NPM; an `https://` scheme here gives 502 "not a TLS handshake") |
| NPM proxy host | `vermilion.cooldad.top` → `192.168.1.222:8099` |
| App env (`/root/stacks/deckbuilder/.env`) | `DECKBUILDER_PORT`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME` (=`zifnabb`), `ADMIN_PASSWORD`, `HTTP_USER_AGENT`, `CLAUDE_QA_PASSWORD` |
| DB env (`databases` stack `.env`) | `DECKBUILDER_PG_PASS` |

Login identity is a **username** (email-free by design — see PLAN §2 decision log); admin bootstraps as `zifnabb`. A non-admin **`claude-qa`** account exists for authenticated API smoke tests.

## Dev loop & redeploy

Both live in the source tree's [`../../deckbuilder/README.md`](../../deckbuilder/README.md) — that's the canonical operational doc. In short: the Mac has no local backend, so dev is an SSH tunnel to the real `:8099` with Vite proxying to it; redeploy is tar → `/root/stacks/deckbuilder/` → detached `docker compose up -d --build`, with a manual container swap because snap-Docker AppArmor blocks `docker stop`.

## Reference material

- **[PLAN.md](PLAN.md)** — full design + decisions/research (status + decision log in §2). **[DESIGN.md](DESIGN.md)** — visual/UX system.
- `ref_builder_groupby_type.png` / `ref_builder_groupby_categories.png` — Archidekt "Stacks" board (layout north-star, PLAN §11).
- `ref_deckbuilding_template.png` — category skeleton with target ranges (PLAN §11–§12).
- `inr-*.webp` — Innistrad Remastered full-art basics, one per colour. **Loose art, not referenced by any spec or shipped code** — dropped in for a purpose that was never written down. Identify or delete.
- `brand/` — `Sanguine Frost` wordmark face (+ specimen), `Cinzel` display, `Libre Franklin` body, with licenses. See DESIGN §2/§7.
