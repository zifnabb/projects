# Projects

Repo-root paths throughout. Read only the card you need.

---

## deckbuilder ("vermilion") — LIVE, active development

A **private, invite-only, Commander-focused MTG deck builder** — Archidekt-shaped, with **zero
community surface** (no feeds, likes, views, or discovery). For the user and a few friends.

| | |
|---|---|
| Source | `deckbuilder/` — `backend/` (FastAPI, Python 3.12) + `frontend/` (React SPA, Vite + TS) |
| Stack dir | `stacks/deckbuilder/` — also holds PLAN.md, DESIGN.md, brand assets, reference screenshots |
| Container / port | `deckbuilder` / **8099**, host-networked |
| Database | `deckbuilder-postgres` / **5436**, in the `databases` stack; data at `/mnt/Memory Card/docker-data/deckbuilder-pg/` |
| Public at | `vermilion.cooldad.top` — app's own login, **no Authentik** |
| Branch | `deckbuilder-build` (48 commits ahead of `main`) |

**Read `stacks/deckbuilder/PLAN.md` §2 before doing anything here.** It is the decision log: what
shipped, what was locked, what was cut for good, and the current backlog. 19 sections total;
§11 is the stats sidebar, §14 the Synergy tab, §16 the post-MVP queue.

### Architecture facts that constrain changes

- **One multi-stage image**: `node:22` builds the SPA → `python:3.12-slim` runtime serves the API
  under `/api` and the built SPA as static. No Node at runtime.
- **Login identity is a `username`, not an email.** The app is deliberately email-free (no
  mailserver dependency, admin-assisted resets). Admin bootstraps as `zifnabb`. Anywhere older
  spec text says "email" as the identifier, read username.
- **All third-party HTTP goes through one shared adapter** (`backend/app/http_adapter.py`):
  descriptive User-Agent, ~8 req/s throttle, backoff on 429, responses cached in the Postgres
  `api_cache` table. The frontend never calls a third party directly. **No Redis** — decided;
  Postgres caches are sufficient.
- **Card data is local**: nightly Scryfall bulk sync into `cards` (~38k gameplay-unique) and
  `printings` (~109k). Live search *proxies* Scryfall because `otag:`/`function:` operators exist
  only in their API, not the bulk export.
- Migrations are Alembic, currently at `0005`. `backend/app/routers/decks.py` (800 lines) and
  `io.py` (610) are the two big ones.

### Status

All phases 0–7 shipped 2026-07-19; feedback pass 1 closed 2026-07-20. A 7-finding adversarial
code review (2026-07-30) was fixed, deployed, and verified live 2026-07-31 — image `f14e7394`.

**Next up:** Stats sidebar v2 (PLAN §11) → Synergy tab (§14) → pricing/EDHREC/Combos (§16).

**Out of scope permanently** — do not propose these: deck grading (salt/bracket/power), undo or
version history, playtester/goldfish, any social or community surface.

### Operational

Dev loop and the redeploy sequence are in `deckbuilder/README.md`. The Mac has no local
backend or Postgres, so dev is an SSH tunnel to the real `:8099` with Vite proxying into it —
**dev writes hit the live database.** Use Chrome/Firefox, not Safari (Secure cookie on
plain-http localhost). A `claude-qa` non-admin account exists for authenticated API smoke tests.

Cloudflare swallows 5xx bodies, so the app deliberately returns **422, not 5xx**, for degraded
URL-imports.

---

## lavender-dashboard — stable

Custom homelab dashboard (replaced gethomepage). FastAPI + vanilla HTML/JS/CSS, no build step.
Container health grid, SVG network topology, CPU/RAM gauges, disk bars, live over SSE.

| | |
|---|---|
| Source | `lavender-dashboard/` |
| Port / public at | 7575 / `celadon.cooldad.top` (Authentik) |
| Config | `lavender-dashboard/app/config.py` — `STACKS`, `SUBDOMAINS`, `DISKS`, `INTERNAL_SERVICES`, `NO_LINK` |

**This is the file that goes stale.** Any new service, subdomain, or port needs a `SUBDOMAINS`
entry plus a dashboard rebuild, or it simply won't appear. The subdomain→container join is on
**exact container name** (`main.py` builds `container_links`, `app.js` looks up `containerLinks[c.name]`),
so a container renamed by the AppArmor swap dance loses its link silently.

Collectors read the host through bind mounts (`/proc`, `/sys`, and one per disk); the container
is `read_only: true` with no persistent state. Boot-drive stats probe `/home` because
bind-mounting `/` returns overlay-FS numbers from inside Docker.

---

## mcp-server — stable, not currently wired to a client

Model Context Protocol server giving a local AI agent eyes and hands on the homelab's Docker.

| | |
|---|---|
| Source | `mcp-server/` (single file: `app/server.py`) |
| Stack dir | `stacks/mcp/` · container `lavender-mcp` · port 8765 |
| Transport | stdio (`docker exec -i`), with an HTTP listener also running |

Tools: `list_stacks`, `manage_stack`, `restart_service`/`stop_service`/`start_service`,
`plan_action`, `list_containers`, `get_logs`, `system_status`. Destructive actions refuse without
`force=true`; `plan_action` previews safely.

Two caveats:
- **No MCP client is configured against it** — `~/.claude.json` has no `mcpServers` entry for this
  project. It runs, but nothing is using it.
- AGENTS.md contains a long "PLAN: Expanding HTTP/SSH to the MCP Server" that was **never
  executed** (annotated as such 2026-07-31). Its "Current State" list is stale too — it says
  stdio-only with no HTTP endpoint, but `:8765` is listening. Probe before asserting.

It has near-root control of Docker. Never expose it without auth.

---

## stacks/ — documentation mirror

One dir per stack, each with a `README.md` (service table, volumes, gotchas) and usually the
`docker-compose.yml` that mirrors what Dockge manages. These READMEs are the primary operational
docs and are worth keeping high quality.

Note: `stacks/lunamultiplayer/` is retained deliberately as an **archived** README for a removed
service. Satisfactory is likewise removed (though its 2.8 GB data dir survives on the server).
Several stacks reference **external volumes named `bkstacker_*`** — the original monolith all
current stacks were split out of. Those volumes are live; don't prune them.

---

## Test-cases — remote only, not in this repo

TestLink/Jira/Zephyr manual-test-case enrichment for AWPTCM, living at
`/media/terrenceb/mnt/testbox_home/copilot/Test-cases/` on **terrenceb-dl**. The goal is to derive
Objectives for manual cases from TestLink history plus enriched ATPyLib automated suites, and to
record many-to-one suite→case mappings.

There is **no local copy** in this repo. The README and AGENTS.md used to claim one and linked to
a `Test-cases/README.md` that never existed; both were corrected 2026-07-31. Work on it over the
nested SSH hop (see `references/access.md`), and check with the user before creating a local
copy — the tree contains `secrets.md` with live JIRA and TestLink keys.
