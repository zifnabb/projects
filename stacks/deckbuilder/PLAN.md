# Deckbuilder ("vermilion") — Plan & Full Context

> Self-contained planning doc for a **private, invite-only, self-hosted Magic: The Gathering deck builder** on the LavenderTown homelab. Written to be executed or extended in a **later/cold session** — it carries the decisions, the research behind them, and the reference-app lineage. Nothing here is built yet.
>
> Related: mirror plan at `~/.claude/plans/calm-herding-moth.md`; memory `project-mtg-deckbuilder`. Homelab conventions in root [../../README.md](../../README.md) and [../../AGENTS.md](../../AGENTS.md).

---

## 1. Goal & guiding principles

A **private Archidekt/Moxfield-style deck builder** for the user + a few friends, **with zero community/social surface**. Primarily for **Commander/EDH**. Backed by the **Scryfall API** and **EDHREC**.

- **Archidekt is the north-star** for feel/feature shape (the user prefers it over Moxfield).
- **Delegate, don't rebuild** the hard analytical stuff (salt/bracket/power) to specialist sites.
- **Robust core, fragile enrichment quarantined** — the deck builder must be fully useful on Scryfall alone; EDHREC/grading are enrichment that may fail gracefully.
- **Design-in-now, build-later** — MVP is architected so post-MVP features slot in without rework (theming, format catalog, tag sources, search tab-shell, grading hooks, shared HTTP adapter).

## 2. Status & open items

- **Plan approved.** Nothing implemented yet.
- **BLOCKER (post-MVP only):** send a courtesy email to the **commandersalt.com dev** before shipping the grading link-out (attribution + backlink offered in return).
- **Verify before deploy:** ports **8099** (app) and **5436** (Postgres) are still free — check the port map in [../../README.md](../../README.md). Subdomain `vermilion` confirmed unused at planning time.
- **Deferred decisions:** whether to add Redis (currently: Postgres-backed caches are enough); whether "shared" decks get a discovery feed (currently: explicit per-deck share links only, no feed).

---

## 3. Reference apps — what we take from each

Screenshots were compared across Archidekt, Moxfield, and Scryfall's deck builder. Lineage of adopted ideas:

**From Archidekt (primary model):**
- Deck header: title · "updated X ago" · format · legality ✓/✗ · size · tags · clone · export.
- In-context **tabbed search panel** (Close/Lock, pinnable) — NOT a modal.
- First-run **coach-marks** highlighting how to start an empty deck.
- Collapsible/pinnable **stats side-liner** (Deck Info, Color Cost & Production, curve, category counts).
- Command Zone is **optional** even when a commander is picked.
- Multi-tab search shell: Archidekt-search / Syntax / EDH Recs / Landbase / Combos (we generalize this).
- "Est Bracket" / "Salt sum" in the header → we delegate these to commandersalt (see §6).

**From Moxfield:**
- Home page: **Card search + Deck search** (unified, tabbed).
- **"Search only legal cards"** toggle + default commander choice at creation.
- On-page card search with **Scryfall-syntax reminder** text.
- **Edit description + change deck art** directly on the deck page.
- Advanced Search form that **"automatically converts to Scryfall syntax"** (we adopt the concept, in-context not modal).

**From Scryfall:**
- **Randomized deck title** (no forced name entry) — user's favorite.
- **Cleanest empty-deck layout** + the "How does this work?" help text (we adapt to our tools).
- Format picker with **rules/description info** per format.
- **Advanced Search** form layout (detailed fields, helper captions, examples, comparison operators, add-symbol).
- Night-mode toggle (both Archidekt & Moxfield too).

**Explicitly disliked / cut:** all community links, Brewers, global recent-decks feed, Patreon/ads, **views**, **likes**.

---

## 4. Architecture (locked)

- **Frontend:** React SPA (Vite + TypeScript). Chosen over HTMX/Svelte for the app-like deck-editing UX (drag between zones, live charts) + biggest ecosystem/help; user knows Python best but is fine with JS.
- **Backend:** FastAPI (Python 3.12) + SQLAlchemy 2.0 async (asyncpg) + Alembic + Pydantic. All MTG logic lives here.
- **Database:** PostgreSQL — new instance in the centralized `databases` stack.
- **One container, multi-stage Docker:** `node:22` stage builds the SPA → static assets copied into a `python:3.12-slim` image running `uvicorn` (mirrors [../lavender-dashboard/Dockerfile](../lavender-dashboard) + a frontend stage). **No Node at runtime**; the rsync→Dockge→`build: .` flow is unchanged from `mcp-server`.
- **Themeable (dark/light) from day one** — CSS variables + React theme context, persisted per user. Hard requirement.
- **Shared outbound-HTTP adapter** — ONE polite client behind which ALL third-party calls sit (Scryfall search, EDHREC, Commander Spellbook, commandersalt): descriptive `User-Agent`, `<10 req/s` throttle+queue, backoff-on-429, response cache (Postgres `api_cache`; Redis optional later), graceful-degrade. Frontend never calls third parties directly (CORS + caching + swappability).

### Fixed values (verify ports before deploy)
| Thing | Value |
|---|---|
| Repo source dir | `deckbuilder/` (top-level sibling of `mcp-server/`, `lavender-dashboard/`) |
| Stack dir | `stacks/deckbuilder/` (this dir) |
| App container / port | `deckbuilder` / **8099** |
| DB container / port | `deckbuilder-postgres` / **5436** |
| DB data path | `/mnt/Memory Card/docker-data/deckbuilder-pg/` |
| DB password env | `DECKBUILDER_PG_PASS` (in repo-root `.env`) |
| Subdomain | `vermilion.cooldad.top` — **public, app's own login, NO Authentik** |
| Admin bootstrap | env vars on first boot (e.g. `ADMIN_EMAIL`/`ADMIN_PASSWORD`) |
| JWT | `JWT_SECRET` env; token in httpOnly cookie |

---

## 5. Data sources & integration analysis (the research)

This is the most important context to preserve — each integration's viability, terms, and fragility were researched.

### Scryfall — card data (SOLID, core)
- **Bulk data** (daily gzipped JSONL at `*.scryfall.io`, no rate limit): synced **nightly** into local Postgres `cards`. Powers autocomplete, hydration, stats, offline. Cache ≥24h (their guidance). Use Oracle Cards for gameplay-unique rows; Default Cards later for printing/art selection.
- **Search API** (`/cards/search`, free, no key, **<10 req/s**, cache ≥24h): **proxied server-side** to provide **full Scryfall syntax** (see §8). A local parser CANNOT replicate `otag:`/`function:` tagger operators — that data isn't in the bulk export — so full syntax REQUIRES proxying to Scryfall.
- **Images:** hotlink from Scryfall CDN (`image_uris`), don't store.
- Requirements: descriptive `User-Agent` + `Accept` headers, throttle, backoff.
- Key fields used: `oracle_id`, `mana_cost`, `cmc`, `type_line`, `colors`, `color_identity`, **`produced_mana`** (makes "Color Production" free), `legalities`, `prices`, `keywords`.

### EDHREC — recommendations/similar/popularity (FRAGILE)
- **No official API.** Unofficial `json.edhrec.com` endpoints its own site uses; can break without notice.
- Usage: **on-demand** (Archidekt-style single-access when a tab is opened), **cached**, **graceful-degrade** (app fully works without it). NOT stored as durable data per user preference.
- Powers: EDH Recs tab, Synergy "similar cards" cross-ref, Landbase popularity.

### Commander Spellbook — combos (ROBUST)
- **Real open, documented, community API + downloadable combo dataset.** The one clean third-party source.
- Powers: Combos tab ("Included" = fully in deck / "Almost Included" = missing ~1) and the Synergy "combos with this card" cross-ref. (Also could power local bracket estimation if ever wanted — but bracket is delegated, see below.)

### commandersalt.com — salt / bracket / power grading (DELEGATED via link-out)
- Best-in-class salt+bracket+power judge; hand-built by a senior dev, refined against ~1.69M indexed decks. **Do NOT rebuild** — salt is crowd-sentiment (not computable locally); power is a contested, data-heavy rabbit hole; bracket is buildable (WotC Game Changers list + Commander Spellbook combos + curated lists) but redundant.
- **Has an undocumented-but-real JSON API.** Confirmed example (per-card): `https://api.commandersalt.com/details?id=kenrith_the_returned_king&isCard=true` returns salt, price, parsed oracle, etc. Deck endpoint is by analogy `…/details?id={deckhash}` (site URL `/details/deck/{hash}`). Deck grading requires ingesting the deck first (get a hash), then GETting details.
- **Chosen integration = "Grade My Deck" LINK-OUT** (opt-in per deck) that hands the decklist to commandersalt and shows credit + links back — NOT embedding their data. Rationale: respectful to a solo dev, zero grading logic/maintenance in our code, and grading sends the deck to their public index (opt-in, never automatic — user is OK with the send).
- **BLOCKED on a courtesy email to the dev** before shipping. Provider-agnostic hook so it could upgrade to *embedded* (using their API) if blessed. Reserved deck fields `commandersalt_hash`/`grade_json`/`graded_at` support that upgrade.

### DeckCheck (deckcheck.co) — REJECTED for grading
- Clean, documented, keyed API (`/api/external/deck`, `/deck-search`) — BUT **read-only over decks already on DeckCheck** (no "analyze an arbitrary list" endpoint), so it **cannot grade our private decks**. Also its **Permitted Use ToS explicitly forbids** using the API/data to build a "deck database / recommendation system / analytics product / similar service," calling undocumented endpoints, or combining with automation.
- Metrics offered: `bracket` + `performanceIndex` (CRISPI), no salt.
- **Only ToS-compliant future use:** an optional post-MVP "discover **public** DeckCheck decks" feature (keyed `/deck-search`, read + link back) — deck *discovery*, not grading.

### Oracle tags (otag) — limitation & solution
- Scryfall's Tagger data (`otag:`/`function:`, e.g. "mana dork") is **not in the bulk export** and has no clean public API.
- **Solution for the Synergy tab (§8):** build a **local otag index** by enumerating Scryfall's tag catalog and running `otag:<tag>` through the sanctioned **search API** (cached, periodic job — like the nightly bulk sync). Yields a local card↔tag graph legitimately; both directions become fast/offline. Soft dependency: obtaining the tag-name list once (browsable on Tagger; curate/refresh occasionally).

---

## 6. Data model (Postgres)

- **`cards`** — Scryfall bulk fields (see §5). `pg_trgm` + full-text indexes on name/text for local autocomplete/search.
- **`users`** — id, email, password_hash (bcrypt), display_name, is_admin, theme_pref, created_at.
- **`invites`** — code, created_by, used_by, expires_at (invite-only registration).
- **`decks`** — id, user_id, name (auto-randomized if blank), format, commander_card_id (nullable), color_identity, description, deck_art_card_id, visibility (`private`|`shared`), created_at, updated_at. **Reserved grading hooks (inert until post-MVP):** `commandersalt_hash`, `grade_json`, `graded_at`.
- **`deck_cards`** — deck_id, card ref, board (`main`|`side`|`maybe`|`command`), quantity, finish.
- **`deck_tags`** — deck_id, tag, **`source` (`user`|`system`)**.
- **`api_cache`** — provider, key, payload jsonb, fetched_at, ttl (shared-adapter cache; also backs the otag index).
- *(later)* **`otag_index`** — card↔tag membership for the Synergy tab.

### Format catalog (config structure, not a table)
Per format: display name, rules/description text, deck size, singleton flag, requires-commander, color-identity enforcement, banlist source. **Drives three things at once:** New-Deck format picker (rules info) · legality validator (header ✓/✗) · **Draft→Legal auto-tag**. MVP: **Commander** (full rules, default) + **Freeform/Other** fallback. More formats = later data entries.

### Tags model
- **User tags** — manual (e.g. "Superfriends", "budget").
- **System/auto tags** — computed, not user-edited. MVP: **`Draft`** (default-on) flips to **`Legal`/`Playable`** when the deck passes format validation. Orthogonal to visibility (a Draft deck is still shareable). Post-MVP: archetype auto-tags via the same pipeline (this IS the "auto-tagging tool").

---

## 7. MVP feature set (per screen, with lineage)

**Auth** — invite-only registration (admin mints codes; admin bootstrapped via env), bcrypt + JWT httpOnly cookie.

**Home dashboard (post-login)** — unified search (Cards ↔ Decks tabs) *(Moxfield)*; **your** recent decks as cards with commander art + color-pip bar + format + tags *(Archidekt)*; New Deck CTA; **night-mode toggle** *(both)*. NO community/feed/likes/views. "Recent decks" & "Deck search" = **your own decks only**.

**New Deck flow** — name **optional**, auto-**randomized** MTG name if blank *(Scryfall)*; **Commander default** format with inline **rules info** *(Scryfall)*; commander picker with **"legal cards only"** toggle *(Moxfield)*, but **optional** command zone *(Archidekt)*; compact layout + collapsible Extra Options.

**Deck builder** — clean empty state + adapted help text *(Scryfall)* + first-run coach-marks *(Archidekt)*; on-page card search *(Moxfield)*; boards (main/side/maybe/command); commander **color-identity validation**; inline description edit + **change deck art from the page** *(Moxfield)*.

**Search** — the backbone (full spec §8).

**Deck header** — title · "updated X ago" · format · **legality ✓/✗** · size · user tags · **clone** · **export** (text/Arena/Moxfield/CSV) · import.

**Multi-view deck display** — view-as / group-by / sort-by / local-filter + layout presets *(Archidekt/Moxfield)*, your decks.

**Stats sidebar** (collapsible/pinnable) — mana curve · avg+total mana value · type counts · **color cost & production** (from `mana_cost` + `produced_mana`).

**Tags/visibility** — user + system tags (Draft→Legal); Private vs Shared-link.

**Scryfall bulk sync** — nightly APScheduler job → upsert `cards`; manual admin resync endpoint.

---

## 8. Search — full spec (core MVP)

**Presentation:** in-context **tabbed panel (NOT modal)**, pinnable (Close/Lock), opened from the builder. Extensible tab-shell (post-MVP tabs slot in).

**Hybrid two-lane backend:**
- **Autocomplete / quick-add** → **local Postgres** (`pg_trgm`), instant, no API calls per keystroke.
- **Full search** → **proxy to Scryfall `/cards/search`** (server-side, cached, throttled), results hydrated from local `cards`, fallback to Scryfall payload for brand-new cards. **Graceful-degrade** to local name+filter search if Scryfall is down.

**Three MVP tabs (input modes):**
1. **Standard** — simple box + quick filters (local-first).
2. **Advanced** — Scryfall-Advanced-style form (name, text+add-symbol, type-line, colors + **commander/color-identity**, mana cost, stats with comparison dropdowns, games, sort). **Compiles to — and displays back — the generated Scryfall syntax** (a live teaching tool). Show the "we auto-convert to Scryfall syntax" note.
3. **Syntax** — raw Scryfall query bar + "apply smart filters" toggle + syntax guide.

All lanes are **color-identity + legality aware** (filter by commander identity when set; "legal only" toggle from `legalities`).

**Post-MVP tabs (shell built now, populated later):**
- **EDH Recs** (EDHREC; requires commander → friendly gate if none; type filter All/Artifact/Creature/…).
- **Combos** (Commander Spellbook; "Included"/"Almost Included"; robust).
- **Landbase** (Scryfall + EDHREC popularity + curated **cycles**; color-identity-filtered).
- **Synergy (SIGNATURE, this app's unique tab)** — search a card → functionally-related cards, color-identity-aware. **7 cross-references (all approved):**
  1. **Otag/function** (mana dork, ramp, removal…) — via local otag index (§5).
  2. **Supertype** (Creature/Land/Artifact/…).
  3. **Tribe** (creature subtypes, "other Elves").
  4. **Produces-mana** (shared `produced_mana`).
  5. **Shared keywords**.
  6. **Budget alternative** (same function, cheaper — needs pricing).
  7. **Combos with this card** (Commander Spellbook) + **EDHREC similar-cards** + **reprints/alt printings**.
  - Build tiers: **v1** curated function dropdown + `otag:` search + supertype/color-identity filters (robust, no per-card index); **v2** full per-card tag chips via the local otag index.

---

## 9. Post-MVP roadmap

- **Pricing** — Scryfall `prices` + snapshot date + click-through + printing selection; price-source toggle. (User's gripe: listed prices drift from source — mitigate with snapshot date + verify link + exact-printing selection; a live vendor feed is a further step.)
- **Synergy tab** (signature — see §8) + its **otag-index job**.
- **EDH Recs / Combos / Landbase** tabs.
- **"Grade My Deck"** link-out to commandersalt (blocked on dev email).
- **Auto-tagging** (archetype system-tags).
- **DeckCheck "discover public decks"** (keyed, ToS-compliant, read-only).
- Possibly **Redis** if Postgres caches need speed.

**Cut for good:** views, likes, all social/community · self-built salt/bracket/power · DeckCheck for grading our own decks.

---

## 10. Build phasing

0. **Scaffold** — `deckbuilder/` (FastAPI + Vite/React skeleton), this stack's `docker-compose.yml`, local `docker compose up` "hello".
1. **Card data** — schema + Alembic, Scryfall bulk sync job, `cards` + indexes.
2. **Search** — shared HTTP adapter + Scryfall proxy, local autocomplete, 3 tabs, filter→syntax compiler.
3. **Auth** — invite-only registration, JWT, admin bootstrap.
4. **Decks** — CRUD, boards, format catalog + legality engine, Draft/Legal auto-tag, color-identity validation, commander picker.
5. **UI** — home, new-deck, builder + empty state/coach-marks, deck header, multi-view, stats sidebar, theming.
6. **Export/Import** + polish.
7. **Deploy** (§11).

---

## 11. Deployment (follows AGENTS.md custom-build pattern)

Homelab facts needed: SSH `ssh mrfuji@diglettscave.cooldad.top` (Cloudflare Tunnel); stacks on server at `/root/stacks/` (needs `sudo`; `mrfuji` can't traverse directly); server IP `192.168.1.222`; Dockge manages stacks; NPM (infra stack) does proxy; cloudflared (bigstackd) provides tunnel — **must stay running**. Data on `/mnt/Memory Card/docker-data/`.

1. **Database** — add `deckbuilder-postgres` to [../databases/docker-compose.yml](../databases/docker-compose.yml), mirroring `invidious-postgres`: `postgres:16-alpine`, `network_mode: host`, `command: -p 5436`, `POSTGRES_DB/USER/PASSWORD` (`${DECKBUILDER_PG_PASS}`), data bind `/mnt/Memory Card/docker-data/deckbuilder-pg:/var/lib/postgresql/data`, `pg_isready -p 5436` healthcheck. Update [../databases/README.md](../databases/README.md), add `DECKBUILDER_PG_PASS` to root `.env`, deploy via Dockge.
2. **App** — `rsync -av --delete deckbuilder/ mrfuji@diglettscave.cooldad.top:/root/stacks/deckbuilder/`; in Dockge add the stack and enable **Build**; compose uses `build: .`; `docker compose up -d --build`.
3. **Proxy** — NPM host `vermilion.cooldad.top` → `192.168.1.222:8099`, **no Authentik forward-auth**; add the Cloudflare Tunnel route for `vermilion`.
4. **Docs** — root [../../README.md](../../README.md): port map (8099 app, 5436 PG) + subdomains table (`vermilion` → deckbuilder, auth: -). This dir's `README.md` (operational). `deckbuilder` entry in `STACKS` + `SUBDOMAINS` (auth: false) in [../lavender-dashboard/app/config.py](../lavender-dashboard). Note the service + gotchas in [../../AGENTS.md](../../AGENTS.md).

## 12. Verification

- **Local:** `docker compose up -d --build` in `deckbuilder/`; `localhost:8099` → invite-register, login, create deck (random name), set commander, verify color-identity-filtered search + **Draft→Legal flip** at a legal 100-card deck, run Standard/Advanced/Syntax searches incl. an `otag:`/`o:` query (proves the Scryfall proxy), confirm stats sidebar (curve + color cost/production), export/import round-trip, night-mode toggle.
- **Scryfall sync:** manual resync → `cards` populated; stop the proxy → local autocomplete still works (fallback).
- **Server:** `curl -I` app on `:8099`; `vermilion.cooldad.top` loads via tunnel; `deckbuilder-postgres` healthy (`pg_isready -p 5436`); service shows in lavender-dashboard.
