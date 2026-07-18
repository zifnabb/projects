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

- **Plan approved.** Build started 2026-07-18 on branch `deckbuilder-build` (Phases 0–4 first, review before Phase 5/UI).
- **DECISION (2026-07-18) — login identity is `username`, not email.** The app is already email-free (no mailserver, admin-assisted resets), so email is dropped entirely: `users` uses a unique **`username`** as the login identity; register/login forms take username; the admin panel lists by username; admin bootstraps as **`zifnabb`**. "No user enumeration" and rate-limit rules apply to username. Wherever §6/§15 below say "email" as the identifier, read **username**. (A polite contact email may still appear in the outbound HTTP `User-Agent` for third-party APIs — unrelated to login.)
- **BLOCKER (post-MVP only):** send a courtesy email to the **commandersalt.com dev** before shipping the grading link-out (attribution + backlink offered in return). *(Same blocker gates the EDH Salt Score row on the card-detail More Info tab, §9.)*
- **SOFT BLOCKER (MVP import):** **Moxfield URL-import** is access-sensitive (their API enforces UA rules / has restricted third-party use) — do a courtesy-check before shipping *Moxfield* URL pull (§13). Archidekt URL-import (the primary migration path) and paste/upload import are unaffected.
- **Verify before deploy:** ports **8099** (app) and **5436** (Postgres) are still free — check the port map in [../../README.md](../../README.md). Subdomain `vermilion` confirmed unused at planning time.
- **Deferred decisions:** whether to add Redis (currently: Postgres-backed caches are enough); whether "shared" decks get a discovery feed (currently: explicit per-deck share links only, no feed); scope of the **Default Cards (all-printings) sync** — pulled into MVP for the card-detail printing selector (§9), kept slim (printing rows only, prices reserved).

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
- **Shared outbound-HTTP adapter** — ONE polite client behind which ALL third-party calls sit (Scryfall search, EDHREC, Commander Spellbook, commandersalt, **Archidekt/Moxfield deck URL-import §13**): descriptive `User-Agent`, `<10 req/s` throttle+queue, backoff-on-429, response cache (Postgres `api_cache`; Redis optional later), graceful-degrade. Frontend never calls third parties directly (CORS + caching + swappability).

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
- **Bulk data** (daily gzipped JSONL at `*.scryfall.io`, no rate limit): synced **nightly** into local Postgres `cards`. Powers autocomplete, hydration, stats, offline. Cache ≥24h (their guidance). Use Oracle Cards for gameplay-unique rows; **Default Cards** (all printings/art/prices) for printing/art selection — a **slimmed sync pulled into MVP** by the card-detail printing selector (§9), landing in a `printings` table hung off `oracle_id`.
- **Search API** (`/cards/search`, free, no key, **<10 req/s**, cache ≥24h): **proxied server-side** to provide **full Scryfall syntax** (see §8). A local parser CANNOT replicate `otag:`/`function:` tagger operators — that data isn't in the bulk export — so full syntax REQUIRES proxying to Scryfall.
- **Images:** hotlink from Scryfall CDN (`image_uris`), don't store.
- **Rulings** (`/cards/:id/rulings`, **not in bulk**): fetched **on-demand** via the shared adapter, cached in `api_cache`, for the card-detail Rulings tab (§9).
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
- **Solution for the Synergy tab (§8/§14):** build a **local otag index** by enumerating Scryfall's tag catalog and running `otag:<tag>` through the sanctioned **search API** (cached, periodic job — like the nightly bulk sync). Yields a local card↔tag graph legitimately; both directions become fast/offline. Soft dependency: obtaining the tag-name list once (browsable on Tagger; curate/refresh occasionally).

---

## 6. Data model (Postgres)

- **`cards`** — Scryfall bulk fields (see §5). `pg_trgm` + full-text indexes on name/text for local autocomplete/search.
- **`users`** — id, email, password_hash (bcrypt), display_name, is_admin, theme_pref, created_at, **`is_active`**, **`last_login_at`**, **`token_version`** (per-user session invalidation, §15).
- **`invites`** — `code` (**is** the magic-link token — random urlsafe, §15), created_by, used_by, expires_at, **`note`** (optional "for whom").
- *(§15)* **`password_resets`** — token, user_id, expires_at, used_at (admin-minted one-time reset links; email-free).
- **`decks`** — id, user_id, name (auto-randomized if blank), format, commander_card_id (nullable), color_identity, description, deck_art_card_id, visibility (`private`|`shared`), **`share_token`** (unguessable, nullable — the public read-only link when Shared, §13), created_at, updated_at. **Reserved grading hooks (inert until post-MVP):** `commandersalt_hash`, `grade_json`, `graded_at`.
- **`deck_cards`** — deck_id, card ref, board (`main`|`side`|`maybe`|`command`), quantity, finish, **`printing_id`** (chosen printing; null = default), **`category_id`** (FK → `deck_categories`, nullable = Uncategorized; the multi-view group-by grouping, distinct from board).
- **`deck_categories`** *(§11)* — id, deck_id, name, position, **`target_min`/`target_max`** (nullable count range shown in the column header), color_tag, `source` (`template`|`user`). Deck-level so categories **exist empty**; seeded by the deckbuilding-template toggle (§11), then freely edited.
- *(added for §9)* **`printings`** — per-printing rows off `oracle_id` (set code/name, collector no., rarity, finishes, `image_uris`, **reserved** price fields) from the slimmed Default Cards sync; powers the printing selector + All-printings list.
- **`deck_tags`** — deck_id, tag, **`source` (`user`|`system`)**.
- **`api_cache`** — provider, key, payload jsonb, fetched_at, ttl (shared-adapter cache; also backs the otag index).
- *(later, §14)* **`otag_index`** — card↔tag membership (oracle_id, tag, source) from the periodic `otag:` job + a small **`otag_catalog`** of known tag names (seeded from Tagger). Powers Synergy lane 6 (v2 chips + the function dropdown) + the template-fill loop (§11).

### Format catalog (config structure, not a table)
Per format: display name, rules/description text, deck size, singleton flag, requires-commander, color-identity enforcement, banlist source. **Drives three things at once:** New-Deck format picker (rules info) · legality validator (header ✓/✗) · **Draft→Legal auto-tag**. MVP: **Commander** (full rules, default) + **Freeform/Other** fallback. More formats = later data entries.

### Deckbuilding-template catalog (config structure, not a table)
Per template: name, target format, ordered list of categories each with `name` + optional `target_min`/`target_max`. Seeds `deck_categories` on New Deck when the **"Start from deckbuilding template"** toggle is on (**default on**, §11). MVP: one **Commander skeleton** (`Lands 35-38` · `Ramp/Mana Rocks 8-12` · `Card Draw 8-12` · `Removal 5-10` · `Board Wipes 2-4` · `Main Theme 20-30` · `Flex 0-10`) + **"none"**. More templates = later data entries.

### Tags model
- **User tags** — manual (e.g. "Superfriends", "budget").
- **System/auto tags** — computed, not user-edited. MVP: **`Draft`** (default-on) flips to **`Legal`/`Playable`** when the deck passes format validation. Orthogonal to visibility (a Draft deck is still shareable). Post-MVP: archetype auto-tags via the same pipeline (this IS the "auto-tagging tool").

---

## 7. MVP feature set (per screen, with lineage)

**Auth** — invite-only registration via **magic link** (`/register?invite=<token>`; admin mints; admin bootstrapped via env), **email-free** (admin-assisted password reset), bcrypt + JWT httpOnly cookie, app-side rate-limiting. Minimal admin panel (invites + users). Full spec §15.

**Home dashboard (post-login)** — unified search (Cards ↔ Decks tabs) *(Moxfield)*; **your** recent decks as cards with commander art + color-pip bar + format + tags *(Archidekt)*; New Deck CTA; **night-mode toggle** *(both)*. NO community/feed/likes/views. "Recent decks" & "Deck search" = **your own decks only**. Full spec §10.

**New Deck flow** — name **optional**, auto-**randomized** MTG name if blank *(Scryfall)*; **Commander default** format with inline **rules info** *(Scryfall)*; commander picker with **"legal cards only"** toggle *(Moxfield)*, but **optional** command zone *(Archidekt)*; **"Start from deckbuilding template"** toggle (**default on**) seeding a category skeleton with target ranges (§11); compact layout + collapsible Extra Options. Full spec §12.

**Deck builder** — clean empty state + adapted help text *(Scryfall)* + first-run coach-marks *(Archidekt)*; on-page card search *(Moxfield)*; boards (main/side/maybe/command); commander **color-identity validation**; inline description edit + **change deck art from the page** *(Moxfield)*. Full spec §11 (integrates the header, multi-view, and stats sidebar below).

**Search** — the backbone (full spec §8).

**Card detail panel** — click any card → in-context multi-tab panel: **Card Info** (default; printing/quantity/board/category controls + readable oracle text *(Moxfield)*) · **More Info** (set line w/ clickable set-search · full legality grid · rarity/EDHREC-rank/artist/etc. · related searches) · **Rulings** *(Archidekt)*. Deck-context shows edit controls; bare-search context shows Add-to-Deck. Full spec §9.

**Deck header + export/import** — title · "updated X ago" · format · **legality ✓/✗** (clickable → why) · size · user tags · **clone** · visibility (Private / Shared read-only link) · **export** (text / Arena / JSON) · **smart import** (paste/upload text·Arena·CSV·JSON or Archidekt/Moxfield **URL**, fuzzy-resolve + review; two entry points). Full spec §13.

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
- **Synergy (SIGNATURE, this app's unique tab)** — search a card → functionally-related cards, color-identity-aware. **Full spec §14** (7 lanes, collapsible grouped strips, the template-fill loop, light-lanes-first sequencing). **7 cross-references (all approved):**
  1. **Otag/function** (mana dork, ramp, removal…) — via local otag index (§5).
  2. **Supertype** (Creature/Land/Artifact/…).
  3. **Tribe** (creature subtypes, "other Elves").
  4. **Produces-mana** (shared `produced_mana`).
  5. **Shared keywords**.
  6. **Budget alternative** (same function, cheaper — needs pricing).
  7. **Combos with this card** (Commander Spellbook) + **EDHREC similar-cards** + **reprints/alt printings**.
  - Build tiers: **v1** curated function dropdown + `otag:` search + supertype/color-identity filters (robust, no per-card index); **v2** full per-card tag chips via the local otag index.

---

## 9. Card detail panel (click-a-card "context menu")

Clicking **any** card (in a deck, in search results, in Synergy, anywhere) opens an **in-context multi-tab panel** — card image on the left, tabbed info on the right, Close button, theme-aware. **Archidekt's card modal is the closest model**; we adopt its tab shape and add Moxfield's readable oracle text. Same pinnable in-context discipline as the Search panel (§8) — an overlay, not a full page.

**Context-adaptive** (one component, two modes):
- **In a deck** → deck-editing controls present (quantity ±, printing selector, board/category, set/unset commander) alongside the info.
- **Outside a deck** (bare card search, Synergy, Random) → **info-only** with an **Add to Deck** CTA *(Scryfall lineage)* in place of quantity/category.

**Layout (wireframe — Card Info tab, in-deck mode):**

```
┌─ Card ───────────────────────────────────────────────────── [✕] ┐
│ ┌───────────┐   [ Card Info ]  More Info   Rulings               │
│ │           │   ─────────────                                    │
│ │   card    │   Vorthos, Steward of Myth              {1}{R}     │
│ │   image   │   Legendary Creature — Human Gamer          1/3    │
│ │ (selected │                                                    │
│ │  printing)│   As ~ enters, choose a named Magic character.     │
│ │           │   Each spell you cast with the chosen character in │
│ └───────────┘   its name, flavor, or art costs {W}{U}{B}{R}{G}   │
│  $0.28 · $0.21  less to cast.        ← readable, mana symbols    │
│                 "Just wait, my Madara deck…"   ← flavor, dimmed  │
│  [ − 1 + ]                                                       │
│                 Printing ▾ Unfinity (unf)·126    ◻ Nonfoil/Foil  │
│                 Board:  ⟨Main⟩ Side Maybe Command   ★ Commander  │
│                 Category ▾  (Ramp / Removal / … → group-by)      │
└──────────────────────────────────────────────────────────────────┘
   Bare-search mode: the [−1+] / Board / Category row → [ + Add to Deck ]

   More Info tab (right pane swaps to):
     Set ▸ Unfinity (UNF) · Mythic · #126 · 2022-10-07   ← click → set:unf
     Legalities:  Standard ✗  Modern ✗  Commander ✓  Legacy ✓ …(grid)
     Rarity Mythic · MV 2 · Identity {R} · EDHREC #27948 · C. Gariba
     All printings:  UNF·126  UNF·251  UNF·412 …   [price cols reserved]
     Related:  art:"nicol bolas"   name:"bolas"
     ── enrichment (blank if source down) ──
     Salt 0.00 · Gamechanger: No · Canadian Highlander: None
```

**Tabs (MVP: 3), default Card Info:**

**1. Card Info (default)** — Archidekt's "Card options" **minus the Other Options panel**, **plus** clear oracle text.
- Card image (selected printing), name, mana cost, type line, P/T or loyalty.
- **Clear, human-readable oracle text** with rendered mana symbols at readable size *(Moxfield lineage — the key ask)*; flavor text italic/dimmed below.
- **Quantity** ± control.
- **Printing selector** — dropdown of all printings (set · collector no.), All-printings view, Nonfoil/Foil finish toggle; drives the art shown + (post-MVP) the price line.
- **Board / category** editor — quick options Main / Sideboard / Maybeboard / Command (our `board`) + user **category** assignment (feeds the deck's multi-view group-by); **Set/Unset Commander** when the card is eligible.
- **Cut vs Archidekt:** the Other Options panel (default color tag, custom MV, set deck image, add to collection, add to other deck, pin) — unneeded for our private scope. *("Set as deck art" already lives on the deck page; "add to other deck" is a plausible post-MVP return.)*

**2. More Info** — set / legality / meta, condensed. Combines Archidekt's Card-Info lower fields + Scryfall's card-page right rail (**no oracle text here** — it lives on Card Info).
- **Set line** — set name · code · rarity · collector no. · release date; **clicking the set runs a `set:<code>` search** in the Search panel *(Scryfall lineage — their top-right set box → Set Search)*.
- **All printings** list (set · number); **price columns per printing reserved** (USD/EUR/TIX *(Scryfall)*) — rendered once pricing ships (§16).
- **Full legality grid** — every format ✓/✗ *(all three references show this)*.
- **Meta fields** — Rarity, **EDHREC Rank** (bulk `edhrec_rank`), Artist, Collector Number, Mana Value, Color Identity, Keywords.
- **Related searches** — a few generated example queries (e.g. `art:"<subject>"`, `name:"<name>"`) *(Scryfall)*.
- **Enrichment (fragile, graceful-degrade — quarantined per §1):** EDH **Salt Score** (commandersalt), **Commander Gamechanger** flag (WotC Game Changers list), **Canadian Highlander points**. Blank/omitted when the source is unavailable; the Salt Score row shares the **same commandersalt courtesy-email BLOCKER** as grading (§2). MVP renders the robust bulk fields; enrichment rows slot in as those integrations land.

**3. Rulings** — official Gatherer rulings with dates *(Archidekt "Rulings" tab)*.
- Rulings are **NOT in the Scryfall bulk export** → fetched **on-demand** via the shared HTTP adapter (`/cards/:id/rulings`), **cached** in `api_cache`, graceful-degrade ("rulings unavailable" on fetch failure). Cheap — one cached call when the tab is opened.

**Extensibility:** same tab-shell discipline as Search — post-MVP tabs (**Printings/Art gallery**, **EDHREC card page**, **Combos with this card**) slot in without rework, and the Synergy cross-refs (§8) deep-link into this panel.

**Data dependencies this pulls in:**
- **Default Cards bulk (all printings/art/prices):** the plan deferred this ("Default Cards later"); the printing selector + All-printings list pull a **slimmed** Default-Cards sync into MVP → new `printings` table (set, collector no., finishes, image, reserved price fields) hung off `oracle_id`. Oracle-unique `cards` stays the gameplay table.
- **Rulings cache** (above).
- **Prices stay post-MVP (§16)** — the printing UI reserves the columns; they render when pricing ships.

---

## 10. Home dashboard (post-login landing)

The **personal** entry point — no community, feed, likes, or views (all cut, §3). Everything here is **yours**.

**Frame:**
- **Top bar** — `vermilion` wordmark · unified search box · **night-mode toggle** *(both refs)* · **+ New Deck** · user menu (theme, logout; **Invites** + **Admin** items when `is_admin`).
- **Unified search** — tabbed **Cards ↔ Decks** *(Moxfield home lineage)*:
  - **Cards** — quick card lookup; results open the **card detail panel (§9)** in bare-search mode (Add-to-Deck → pick an existing deck or "new deck with this card"). A light lookup, NOT the full 3-tab builder Search (§8) — that lives in the deck builder.
  - **Decks** — searches **your own decks only** (name · commander · format · tag). No global/community deck search.
- **Your decks** — grid of deck cards *(Archidekt lineage)*, each: commander art (or `deck_art_card_id`), **color-identity pip bar**, format, size, **legality/Draft tag**, user tags, "updated X ago". Click → deck builder. Sort (updated/created/name/format) + filter (format/tag/color). Recent-first default; "View all" when the grid overflows.
- **Empty state** (no decks yet) — friendly prompt + prominent **New Deck** CTA (+ first-run coach-mark, shared with the builder's §7 coach-marks).

**Scope guards:**
- Friends' **shared** decks are reached by **link only** — they do NOT surface on your home (consistent with §2: per-deck share links, no discovery feed).
- Add-to-Deck from a bare home card search needs a target → **deck picker or "start new deck"** (never silently adds).

**Open items:** whether "Your decks" is capped-recent + a full list, or one filterable grid (lean: recent grid + the Decks-tab search as the "all decks" view); whether the home Cards tab shares the builder's Search backend (§8) at reduced chrome or a simpler local-only lookup (lean: local `pg_trgm` autocomplete + on-demand full search behind the same adapter).

**Layout (wireframe):**

```
┌ vermilion ─────────────[ search: Cards | Decks ]────────── ☾  + New Deck  ⌄ ┐
│                                                                             │
│  Your decks                          sort: updated ▾   filter: format/tag ▾ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │   art    │ │   art    │ │   art    │ │   art    │                        │
│  │ Stir-fry │ │ Umezawa  │ │ Frosted  │ │  Lita…   │                        │
│  │ ●●○ EDH  │ │ ●○○ EDH  │ │ ●●● EDH  │ │ ●○○ EDH  │                        │
│  │ ✓ Legal  │ │  Draft   │ │ ✓ Legal  │ │  Draft   │                        │
│  │ 100 · 2d │ │  99 · 5h │ │ 100 · 1w │ │  40 · 3w │                        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         View all →     │
└─────────────────────────────────────────────────────────────────────────────┘
   No decks yet →  centered prompt + [ + New Deck ]  (+ first-run coach-mark)
```

---

## 11. Deck builder page

The **core workspace** — where Search (§8), the card detail panel (§9), boards, multi-view, and the stats sidebar all compose. One deck open at a time. **Archidekt is the layout north-star** — the reference shots in this dir: `ref_builder_groupby_type.png` ⇄ `ref_builder_groupby_categories.png` show the **same deck** in **Stacks** view toggling **Group by: Type** ⇄ **Group by: Categories** (custom buckets); `ref_deckbuilding_template.png` is the deckbuilding-template skeleton. This section realizes the §7 Deck-builder, Deck-header, Multi-view, and Stats-sidebar bullets.

**Regions — a full-width columnar board with a top toolbar; Search & Stats are collapsible rails (NOT an always-on three-column layout):**
- **Deck header (top)** — title (**inline-editable**) · "updated X ago" · format · **legality ✓/✗** (the validator on the §6 format catalog) · size · user tags · **clone** · **export/import** · **visibility** (Private / Shared-link). Full spec §13.
- **Control toolbar (full-width, under header)** — the Archidekt bar, left→right: **Add card / Card search** · **Quick add** (type-to-add, `Cmd+'`) · **View as** (+⚙) · **Group by** · **Sort by** · **Price sources** (post-MVP) · **Local filter** (⌕ + saved-filter ⚙).
- **Left mini-rail** — deck-status icons: **legality ✓** (green when legal) · undo · redo · deck settings ⚙ · more ⋯.
- **Center — the board** — the columnar decklist (below); takes the **full width** — Search and Stats collapse so the board spans edge-to-edge, as in the reference shots.
- **Search panel (§8)** & **Stats sidebar** — **collapsible/pinnable rails** summoned from the toolbar (Card search) or an edge handle; pinned = docked alongside the board, unpinned = overlay.

**The board — columnar "Stacks" multi-view** *(Archidekt)*:
- **View-as** — **Stacks** (default: each group is a column of fanned/overlapping cards read top-down, the focused card shown full) · List · Grid (full images) · Text/Compact.
- **Group-by** — **Categories** · Type · CMC · Color · Rarity · Board. **Default: Categories when the deck has any, else Type** — a template-seeded deck opens on Categories; a from-scratch / no-category deck opens on Type (avoids an empty "Uncategorized" dump). *The two reference shots switching Type ⇄ Categories on one deck are the headline interaction.*
  - **Categories** = user-defined buckets (§6 `deck_categories`) — e.g. the streamer's "Channel Sponsors / Reddit Mods / …" or a functional skeleton "Ramp / Draw / Removal / Lands". A card's category is set on the card panel (§9). Categories can be **named with a target range** shown in the column header — "Draw (7-10)", "Lands (30-35)" — and **exist empty** (they're deck-level, not derived from the cards in them).
  - **Type** = automatic grouping by card type, zero setup.
- **Column header** — name (+ range) · **Qty** · **Price** (post-MVP) · per-column **⋯** (rename · set range · recolor · delete · move).
- **Sort-by** (within columns) — Mana value (default) · name · price (later) · type.
- **Local filter** — instant client-side filter of the open deck *(Archidekt "Filter deck")*, with saveable filters.

**Deckbuilding template (category skeleton)** — *the optional, default-ON new-deck toggle the user asked for.*
- On **New Deck** (Commander), a **"Start from deckbuilding template"** toggle (**default ON**) seeds the deck with an **empty category skeleton** carrying target ranges, so the deck opens already grouped into buckets that guide building (mirrors `ref_deckbuilding_template.png`). Off → a single empty deck, no categories.
- **Default MVP template (Commander)** — a sensible, curatable EDH skeleton, e.g.: `Commander (1)` · `Lands (35-38)` · `Ramp / Mana Rocks (8-12)` · `Card Draw (8-12)` · `Removal (5-10)` · `Board Wipes (2-4)` · `Main Theme (20-30)` · `Flex / Optional (0-10)`.
- Template categories become ordinary `deck_categories` once seeded — rename / retarget / delete freely; adding a card assigns it to a bucket (or **Uncategorized**).
- **Ranges are advisory:** the column header shows count vs target and a bucket under/over range gets a subtle flag — this does **NOT** affect the format legality ✓/✗ (that's the separate validator). The **template catalog is config** (like the §6 format catalog), so more templates/formats slot in later.
- **Template-fill loop (post-MVP, §14):** an **under-filled** column (below `target_min`) offers **"find more <function> in your colors"** → opens the **Synergy tab** seeded by that function (the category name) + the commander's color identity, results one-click-addable back into the column. Turns the ranges from advisory labels into an active fill-assistant.

**Boards vs categories** — orthogonal: **board** (`main/side/maybe/command`) is *where* a card lives; **category** is *how the main board is grouped into columns*. Command zone **optional even with a commander** *(Archidekt)*. Add from Search via drag or Quick-add; quantity steppers on each card; click a card → **card detail panel (§9)**.

**Stats sidebar** *(Archidekt, collapsible/pinnable rail)* — mana curve · avg + total mana value · type counts · category counts (vs target) · **Color Cost & Production** (from `mana_cost` + `produced_mana`, §5 — "free" because the bulk sync carries `produced_mana`). All computed **locally**, no external calls.

**Empty state** — Scryfall's clean layout + "How does this work?" help + first-run coach-marks *(Archidekt)* (open Search · set commander · view controls). *With the template toggle ON a new deck isn't blank — it shows the labelled skeleton columns, and coach-marks point at filling them.*

**Inline deck edits** *(Moxfield)* — edit **description** on-page; **change deck art** (`deck_art_card_id`; picker = a card search → "set as art"); rename via the header title.

**Commander & color identity** — set/unset from the card panel (§9) or a header slot; **color-identity validation** filters Search and flags illegal cards → drives the header ✓/✗ and the **Draft→Legal** auto-tag (§6).

**Autosave** — edits persist immediately (no manual save); "updated X ago" reflects it.

**Open items:** undo / version history (**post-MVP**); Archidekt's **Playtester/goldfish** (post-MVP — cut for MVP); whether category range-flags surface in the left ✓ status or only per-column (lean: per-column; ✓ stays format-legality only); how many built-in templates ship at MVP (lean: one Commander skeleton + "none").

**Layout (wireframe — Stacks view, grouped by Categories, template-seeded):**

```
┌ Zurzoth, Kick Streamer ✎ · updated 3d · Commander · ✓ Legal · 100 · #tags · Clone · Export⌄ · ◔ Private ┐
├ [🔍 Card search] Quick add… │ View as: Stacks▾⚙ │ Group by: Categories▾ │ Sort by: Mana value▾ │ 🔍 Filter deck ┤
├──┬────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│✓ │ ┌Commander(1)┐ ┌Ramp (8-12)┐ ┌Draw (8-12)┐ ┌Removal(5-10)┐ ┌Lands(35-38)┐ ┌Main Theme┐ ┌Flex(0-10)┐      │
│⟲ │ │Qty1  $0.83 │ │Qty10 $16.9│ │Qty8       │ │Qty7         │ │Qty37       │ │Qty…      │ │Qty…      │      │
│⟳ │ │▤ Zurzoth   │ │▤ Sol Ring │ │▤ Wheel…   │ │▤ Path…      │ │▤ Island    │ │▤ …       │ │▤ …       │      │
│⚙ │ │ (full card)│ │▤ Arcane…  │ │▤ Big Score│ │▤ Vandalb…   │ │▤ Mountain  │ │▤ …       │ │          │      │
│… │ │            │ │▤ …fanned  │ │▤ …        │ │▤ …          │ │▤ …×37 fan  │ │▤ …       │ │          │      │
│  │ └────────────┘ └───────────┘ └──────────┘ └─────────────┘ └────────────┘ └──────────┘ └──────────┘      │
└──┴────────────────────────────────────────────────────────────────────────────────────────────────────────┘
  Group by ▸ Categories (shown) ⇄ Type (Commander·Artifact·Creature·Enchantment·Instant·Land·PW·Sorcery) — the two ref shots
  Column ⋯ ▸ rename · set range · recolor · delete · move    New Deck ▸ "Start from template" toggle (default ON) seeds these buckets
```

---

## 12. New Deck flow

The **create step** — kept compact, opens from **+ New Deck** (home §10 / global nav) and lands in the Deck builder (§11) on submit. **Scryfall's clean create** + **Moxfield's create modal** + **Archidekt's optional command zone & collapsible extras**. A modal/panel, not a full page.

**Fields (top-to-bottom, compact):**
1. **Name** — **optional**; the box shows an auto-**randomized MTG-flavored name** *(Scryfall)* used verbatim if left blank, with a **🎲 re-roll**. (Rename anytime later via the header, §11.)
2. **Format** — **Commander default**; picker with inline **rules/description info** per format *(Scryfall)* — deck size · singleton · commander requirement · color-identity enforcement (straight from the §6 format catalog). MVP: **Commander** + **Freeform/Other**.
3. **Commander** *(shown when the format allows/requires one)* — picker with a **"legal cards only" toggle** *(Moxfield, default on)* limiting to valid commanders; **optional** — create without one and set it later *(Archidekt)*. Picking a commander sets the deck's **color identity**.
4. **Start from deckbuilding template** — **toggle, default ON** (§11); seeds the chosen format's category skeleton, with a one-line preview of the buckets ("Lands · Ramp · Draw · Removal · …"). Hidden/disabled for formats without a template (→ none).
5. **Extra Options** *(collapsed by default — Archidekt)* — **visibility** (Private default / Shared-link) · optional **description** · optional starting **deck art**.

**Submit** → create the deck (random name if blank; set commander + color identity; seed `deck_categories` from the template when on; `Draft` system-tag on, §6) → open the **Deck builder (§11)**. **Cancel** discards.

**Behavior / edges:**
- Blank name → the shown random name is persisted (not an empty title).
- Changing **Format** re-evaluates template availability + whether a commander is required/allowed.
- No commander on a Commander deck is allowed → deck stays **Draft** (legality ✗) until valid — expected, not an error.

**Open items:** random-name source (curated local MTG word-list vs a generator — **lean: local curated list, fully offline**); whether "clone existing" and "import list to create a deck" surface here or stay on home/header (**lean: Import + Clone live on the deck card / builder header §11; New Deck stays a clean create**).

**Layout (wireframe):**

```
┌ New Deck ──────────────────────────────────────────────── [✕] ┐
│ Name    ┌───────────────────────────────┐ 🎲                   │
│         │ (blank → "Frosted Aggro 98")  │                      │
│ Format  ┌ Commander ▾ ┐   ⓘ 100-card singleton · needs         │
│         └─────────────┘      commander · color-identity        │
│ Commander ┌ search legendary… ┐  ☑ legal only                  │
│           (optional — set later)                               │
│ ☑ Start from deckbuilding template   → Lands·Ramp·Draw·Removal…│
│ ▸ Extra Options   (visibility ◔ Private · description · art)   │
│                                          [ Cancel ]  [ Create ] │
└────────────────────────────────────────────────────────────────┘
```

---

## 13. Deck header + export / import

The header bar sits atop the Deck builder (§11); export/import hang off it. This is the migration surface — the user is **moving decks off Archidekt**, so import fidelity is a real feature.

**Header controls:**
- **Title** (inline-edit) · **updated X ago** · **format** · **size** (main count vs format target, e.g. `100/100`) · **user tags** (add/remove) · **visibility** ▾.
- **Legality ✓/✗** — **clickable → popover listing every reason** it fails: cards outside the commander's color identity · banlisted cards · singleton violations · wrong size · missing/invalid commander. Green ✓ when clean; drives the Draft→Legal auto-tag (§6).
- **Clone** — duplicate the whole deck (cards, boards, categories, deck art, description; title "… (copy)"; you own the copy; Draft re-evaluated).
- **Visibility: Private / Shared** — Shared mints an **unguessable `share_token`** → a **public read-only deck view** (no auth, no edit, no community chrome — just list + stats). Private revokes it.

**Export** (▾ → copy-to-clipboard or download):
- **Plain text** — `1 Card Name`, grouped into board sections (Commander / Deck / Sideboard / Maybeboard). Universal; categories + printings dropped.
- **MTG Arena** — `1 Card Name (SET) 123` (set + collector), Deck/Sideboard/Commander headers. Printing-aware; accepted by Arena, Moxfield, most importers.
- **Our JSON** — full-fidelity backup: cards, printings, boards, **categories (+ ranges)**, deck art, description, format, tags. The only lossless round-trip.
- *No CSV export* — we **read** CSV on import (incl. Archidekt's) but **don't emit** it; JSON is the full-fidelity out. Price fields stay reserved until pricing ships (§14).

**Import** — one **smart importer**, from **two entry points**:
- **New Deck → "Import a list"** → creates a fresh deck from the import.
- **Header → "Import"** → **add** or **replace** into the currently-open deck.

Pipeline: **input** (paste text · upload `.txt`/`.csv`/`.json` · paste an **Archidekt/Moxfield URL**) → **auto-detect + parse** (plain text · Arena · **CSV incl. Archidekt's → categories preserved** · our JSON · URL pull; tolerant of `1x`, `//`/`#` comments, `# Category` + section headers, split/DFC `A // B`) → **resolve** (fuzzy-match names to local `cards` via `pg_trgm`; set+collector → printing; sections → boards; category headers/columns → `deck_categories`) → **review** (preview with **unresolved/ambiguous lines flagged**, Archidekt/Moxfield-style "N not found", fix-or-skip **before** anything is written) → **commit** (create/merge; set commander + color identity; seed categories; re-run Draft→Legal).

**URL pull (Archidekt / Moxfield)** — *(opted in)* fetch a public deck by URL via the **shared HTTP adapter (§4)** — descriptive UA, throttle, cache, **graceful-degrade**. **Fragile, quarantined:** unofficial endpoints that can change; on failure, fall back to "paste the tool's text/CSV export."
- **Archidekt** = primary (the migration source); its deck JSON carries categories → clean category-preserving move.
- **Moxfield API is access-sensitive** (UA rules / restrictions) → **courtesy-check before shipping Moxfield URL import** (soft blocker, akin to commandersalt §2); paste-export is the always-works fallback.

**Fidelity summary** — back up a deck → **JSON**; share to a pod → **text/Arena**; move from Archidekt → **URL or CSV** (categories intact).

**Open items:** Moxfield URL courtesy-check (above); whether **Clone can target another user's *shared* deck** (lean: yes — clone-from-shared is the friend-sharing loop); merge-import dedupe (same card+printing+board → **sum quantities**, lean).

**Layout (wireframe — header + export/import):**

```
┌ Zurzoth, Kick Streamer ✎ · updated 3d · Commander · [✓ Legal]* · 100/100 · #combo #jank · Clone · Export▾ · Import · ◔ Private▾ ┐
        *click ✗ → popover: "2 illegal: Blood Moon (color identity), Sol Ring (banned) …"        Shared▾ → public read-only link
   Export ▾ ▸ Plain text · MTG Arena · JSON backup
   Import   ▸ paste / upload(.txt·.csv·.json) / Archidekt·Moxfield URL → parse → REVIEW unresolved → [ add | replace | new deck ]
```

---

## 14. Synergy tab (signature — the app's unique surface)

The one thing Archidekt/Moxfield don't do (they punt to EDHREC): **seed a card → functionally-related cards**, color-identity + legality aware, one click to add to the open deck. A tab in the Search shell (§8); also reachable from the card panel (§9 "Find synergies") and from **under-filled template columns** (§11 — the loop, below). **Post-MVP**, layered in (sequencing at the end).

**Seed** — a card (search/pick, the focused card, or a card in the deck) **or** a **function + colors** (from the template loop). Everything below is filtered to the seed and, when a commander is set, to its **color identity** (+ "legal only" toggle) so every suggestion is legal to include.

**Presentation** *(chosen layout)* — one scrolling panel of **collapsible, labelled lane strips**: each lane = a horizontal strip of card results with a count; expand/collapse per lane; remembers which are open. Each result → card detail panel (§9) → **Add to Deck** (or add inline). Empty / dead-source lanes collapse quietly (graceful-degrade).

**The 7 cross-reference lanes** (grouped by data source / robustness):

*Free & offline — from bulk `cards`/`printings`, ship first:*
1. **Supertype** — other cards of the same type (other Planeswalkers/Artifacts). `type_line`.
2. **Tribe** — shared creature subtype ("other Elves/Dragons"). The typal lane.
3. **Produces-mana** — other sources of the same mana / other producers (other Treasure-makers). `produced_mana`.
4. **Shared keywords** — other cards with a shared keyword (Cascade, Convoke). `keywords`.
5. **Reprints / alt printings** — every printing/art of the seed. local `printings` (§9).

*Function — the rich lane, layered as the otag index lands:*
6. **Otag / function** — "does the same job" (mana dork, board wipe, spot removal, cantrip, tutor…). **v1:** a **curated function dropdown** (~30-50 common functions) running `otag:<tag>` through the sanctioned Scryfall search API (cached) + supertype/color-identity filters — robust, no per-card index. **v2:** per-card **tag chips** from the local **otag index** (§5/§6) — click a chip → every card with that function, fully offline.

*External — robust → fragile:*
7. **Combos + similar + budget** — a composite lane:
   - **Combos with this card** — Commander Spellbook (robust API): "Included" / "Almost Included" combos the seed is in (shared with the Combos tab §8).
   - **EDHREC similar-cards** — EDHREC (fragile, graceful-degrade): the crowd "similar" list; hides if EDHREC is down.
   - **Budget alternative** — same function (otag), **cheaper** — needs **pricing (§16)**; surfaces once pricing ships. "Do what this does, for less."

**The template loop** *(wired, §11)* — the function vocabulary (lane 6) **is** the deckbuilding-template category vocabulary (Ramp/Draw/Removal/Board-wipes/Tutors…). An **under-filled template column** (count below `target_min`) shows a **"find more <function> in your colors"** action → opens Synergy **seeded by that function + the commander's color identity**, results one-click-addable back into that column. This turns the template's advisory ranges into an active fill-assistant — the tab's headline integration.

**Robustness / graceful-degrade** — lanes 1-5 always work offline; lane 6 v1 degrades to local text search if Scryfall is down (v2 is offline); Combos is robust; EDHREC-similar and Budget hide when their source/pricing is absent. Consistent with §1 "robust core, fragile enrichment quarantined."

**otag index mechanics** (recap §5) — a periodic job enumerates Scryfall's **tag catalog** (tag names obtained once from Tagger — soft dependency, refreshed occasionally), runs `otag:<tag>` through the search API (cached, throttled, like the nightly bulk sync), and stores card↔tag rows in **`otag_index`** (§6). Both directions become fast/offline; powers lane 6 v2 + the function dropdown.

**Open items:** the curated **function list** (starter ≈ the template categories + common EDH functions — config, curatable); whether a result adds to a *specific* template column vs the deck's default bucket (lean: the seeding column when entered via the loop, else Uncategorized); in-lane ranking (lean: EDHREC popularity when available, else name/CMC).

**Sequencing** *(per decision — light first)* — **wave 1:** the 5 free/offline lanes (a useful Synergy with zero new infra). **wave 2:** otag-function v1 (dropdown via live `otag:`), then the **otag-index job** → v2 chips. **wave 3:** Combos (Commander Spellbook) + EDHREC-similar. **wave 4:** Budget (after pricing §16). The template loop lights up as soon as lane 6 v1 exists.

**Layout (wireframe):**

```
┌ Synergy ─ seed: [ Kenrith, the Returned King ] ⌕   ☑ my colors (WUBRG)  ☑ legal only ┐
│ ▾ Function          [Ramp][Tutor][Draw][Removal]…  (v2: per-card tag chips)           │
│    card card card card card                                      → Add                │
│ ▾ Combos with this    Included (2) · Almost (3)    card card                          │
│ ▾ Tribe (Human)       card card card …                                                │
│ ▸ Produces mana   ▸ Shared keywords   ▸ Supertype   ▸ Reprints   ▸ EDHREC similar     │
│ ▸ Budget alternative   (needs pricing §16)                                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
  Template loop ▸ builder column "Ramp (8-12)" @ 5/8 → "find more Ramp in WUBRG" → seeds this tab
```

---

## 15. Auth & accounts

Invite-only, **app-native** login (no Authentik) on public `vermilion.cooldad.top`. Tiny scale (you + a few friends). Per decisions: **email-free**, **magic-link invites**, **app-side rate-limiting**. Only two unauthenticated surfaces exist — the login/register pages and the `share_token` read-only deck view (§13); everything else needs a session.

**Login** — email + password → set the **JWT httpOnly cookie** → home (§10). "Have an invite? Register" link. No social login; no "remember me" (always remembered via a long-lived cookie). Rate-limited (below).

**Register (magic link)** — reachable only via `/register?invite=<token>` *(admin-generated)*. Validate token (exists · unused · unexpired) → form (email · password · display name) → create user, mark invite `used_by`, log in. Invalid/used/expired → friendly "invite no longer valid". **No open signup.**

**Logout** — clears the cookie.

**Password reset (admin-assisted, email-free)** — no self-serve email flow. User pings admin → admin mints a **one-time reset link** (`/reset?token=<token>`, short expiry) from the admin panel, passes it out-of-band → user sets a new password. (Reserved: could go self-serve-via-email later if the mailserver dependency is ever wanted.)

**Account settings** (self-service) — change display name · change password (requires current) · theme preference (also on the top bar) · sign out. Nothing more.

**Admin panel** (`is_admin`, from the user menu §10) — minimal:
- **Invites** — mint → generates the `/register?invite=<token>` link to copy; optional expiry + "for whom" note; list pending/used; **revoke** an unused one.
- **Users** — list (email · name · created · last-login); **deactivate/reactivate**; **mint a reset link**; promote/demote admin (**guard: never zero admins**).
- No analytics / bulk ops — it's a handful of friends.

**Admin bootstrap** — first boot reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` env → creates the initial admin if absent (idempotent); admin then changes password in Account settings. Env stays the break-glass definition.

**Session / cookie** — JWT signed with `JWT_SECRET` (env), in an **httpOnly · Secure · SameSite=Lax** cookie, **~30-day rolling** expiry (refreshed on activity). Payload: user id · is_admin · `token_version`. Logout clears it; global invalidation = rotate `JWT_SECRET`; boot one user = bump their `token_version`. Cookie scoped to `vermilion.cooldad.top`.

**Security posture (internet-exposed login, no Authentik):**
- **bcrypt** (cost ~12); never store/log plaintext.
- **Rate-limit + lockout** on login **and** reset **and** the register-token endpoint — **per-IP and per-account**, exponential backoff + temporary lockout after N fails (deters credential-stuffing + token guessing). Cloudflare tunnel adds DDoS/WAF in front.
- **Tokens** — invite + reset tokens are cryptographically random, single-use, expiring.
- **Strong `JWT_SECRET`** (long random) in repo-root `.env` (already gitignored per the recent `.gitignore` commit).
- **No user enumeration** — login/reset return generic messages; never reveal whether an email exists.
- The `share_token` view (§13) is the only auth-bypass — token-gated, **read-only**, no write endpoints.

**Data-model touch-ups (§6):** `users` += `is_active`, `last_login_at`, `token_version`; `invites` `code` **is** the magic-link token += optional `note`; new **`password_resets`** (token, user_id, expires_at, used_at).

**Open items:** cookie lifetime (lean 30d rolling); does deactivating a user kill live sessions immediately (lean: yes, via `token_version` bump); confirm the never-zero-admins guard on demote/deactivate.

**Layout (wireframe):**

```
┌ vermilion ─ Sign in ─────────────────┐   Register (invite-only): /register?invite=<token>
│ Email    [____________________]      │   ┌ You've been invited ───────────────┐
│ Password [____________________]      │   │ Email        [______________]      │
│ [ Sign in ]        Have an invite? → │   │ Password     [______________]      │
│  (too many attempts → try again in…) │   │ Display name [______________]      │
└──────────────────────────────────────┘   │ [ Create account ]                 │
                                            └────────────────────────────────────┘
  Admin ▸ Invites: [＋ Mint invite] → copy link · pending/used · revoke    Users: list · deactivate · reset-link · admin toggle
```

---

## 16. Post-MVP roadmap

- **Pricing** — Scryfall `prices` + snapshot date + click-through + printing selection; price-source toggle. (User's gripe: listed prices drift from source — mitigate with snapshot date + verify link + exact-printing selection; a live vendor feed is a further step.)
- **Synergy tab** (signature — **full spec §14**) — ship the 5 free/offline lanes first, then otag-function (v1 dropdown → v2 **otag-index job**), Combos, EDHREC-similar, Budget; wires the template-fill loop (§11).
- **EDH Recs / Combos / Landbase** tabs.
- **"Grade My Deck"** link-out to commandersalt (blocked on dev email).
- **Auto-tagging** (archetype system-tags).
- **DeckCheck "discover public decks"** (keyed, ToS-compliant, read-only).
- Possibly **Redis** if Postgres caches need speed.

**Cut for good:** views, likes, all social/community · self-built salt/bracket/power · DeckCheck for grading our own decks.

---

## 17. Build phasing

0. **Scaffold** — `deckbuilder/` (FastAPI + Vite/React skeleton), this stack's `docker-compose.yml`, local `docker compose up` "hello".
1. **Card data** — schema + Alembic, Scryfall bulk sync job, `cards` + indexes; **slimmed Default-Cards → `printings`** sync (§9).
2. **Search** — shared HTTP adapter + Scryfall proxy, local autocomplete, 3 tabs, filter→syntax compiler; **rulings on-demand+cache** (§9).
3. **Auth** — magic-link invite registration, login/logout, JWT httpOnly cookie (`token_version`), admin bootstrap, **admin panel** (mint/revoke invites · users · reset links), **rate-limit + lockout**, admin-assisted `password_resets` (§15).
4. **Decks** — CRUD, boards, format catalog + legality engine, Draft/Legal auto-tag, color-identity validation, commander picker; `deck_cards.printing_id`; **`deck_categories`** + **template catalog** + New-Deck template toggle (§11).
5. **UI** — home, new-deck (+ template toggle), builder (full-width **Stacks** board, Group-by Categories/Type, column ranges, collapsible Search/Stats rails), empty state/coach-marks, deck header, stats sidebar, theming; **card detail panel** (Card Info / More Info / Rulings, §9).
6. **Header + export/import** — legality-why popover, clone, visibility + `share_token` public read-only view; export (text/Arena/JSON); smart importer (parse text·Arena·CSV·JSON + Archidekt/Moxfield **URL** via the adapter, fuzzy-resolve, review step, add/replace/new) — two entry points (§13). Then polish.
7. **Deploy** (§18).

---

## 18. Deployment (follows AGENTS.md custom-build pattern)

Homelab facts needed: SSH `ssh mrfuji@diglettscave.cooldad.top` (Cloudflare Tunnel); stacks on server at `/root/stacks/` (needs `sudo`; `mrfuji` can't traverse directly); server IP `192.168.1.222`; Dockge manages stacks; NPM (infra stack) does proxy; cloudflared (bigstackd) provides tunnel — **must stay running**. Data on `/mnt/Memory Card/docker-data/`.

1. **Database** — add `deckbuilder-postgres` to [../databases/docker-compose.yml](../databases/docker-compose.yml), mirroring `invidious-postgres`: `postgres:16-alpine`, `network_mode: host`, `command: -p 5436`, `POSTGRES_DB/USER/PASSWORD` (`${DECKBUILDER_PG_PASS}`), data bind `/mnt/Memory Card/docker-data/deckbuilder-pg:/var/lib/postgresql/data`, `pg_isready -p 5436` healthcheck. Update [../databases/README.md](../databases/README.md), add `DECKBUILDER_PG_PASS` to root `.env`, deploy via Dockge.
2. **App** — `rsync -av --delete deckbuilder/ mrfuji@diglettscave.cooldad.top:/root/stacks/deckbuilder/`; in Dockge add the stack and enable **Build**; compose uses `build: .`; `docker compose up -d --build`.
3. **Proxy** — NPM host `vermilion.cooldad.top` → `192.168.1.222:8099`, **no Authentik forward-auth**; add the Cloudflare Tunnel route for `vermilion`.
4. **Docs** — root [../../README.md](../../README.md): port map (8099 app, 5436 PG) + subdomains table (`vermilion` → deckbuilder, auth: -). This dir's `README.md` (operational). `deckbuilder` entry in `STACKS` + `SUBDOMAINS` (auth: false) in [../lavender-dashboard/app/config.py](../lavender-dashboard). Note the service + gotchas in [../../AGENTS.md](../../AGENTS.md).

## 19. Verification

- **Auth (§15):** with no valid invite, `/register` is refused; admin mints an invite → `/register?invite=<token>` creates the account (token now single-use/spent); login sets the httpOnly cookie, logout clears it; **rate-limit** kicks in after N bad logins (lockout message); admin **reset link** lets a user set a new password; **deactivating** a user blocks login + kills their live session (`token_version` bump); the never-zero-admins guard blocks demoting the last admin.
- **Local:** `docker compose up -d --build` in `deckbuilder/`; `localhost:8099` → invite-register, login, create deck (random name), set commander, verify color-identity-filtered search + **Draft→Legal flip** at a legal 100-card deck, run Standard/Advanced/Syntax searches incl. an `otag:`/`o:` query (proves the Scryfall proxy), confirm stats sidebar (curve + color cost/production), export/import round-trip, night-mode toggle.
- **New Deck flow:** open New Deck → blank name shows a **random MTG name** (🎲 re-rolls) and persists if left blank; **Commander default** with inline **rules info**; commander picker with **legal-only** toggle (optional — can skip); create → lands in the builder. With **"Start from deckbuilding template" ON (default)** the builder opens pre-seeded with labelled skeleton columns (`Lands 35-38`, `Ramp 8-12`, …) each showing count-vs-range, **grouped by Categories**; toggle OFF → single empty deck, no categories, **grouped by Type**.
- **Deck builder:** header shows legality ✓/✗ + size + updated-ago; add cards from Search (drag + quick-add), each lands in a category (or Uncategorized); toggle **Group by: Categories ⇄ Type** in **Stacks** view (columns re-shape); rename a category + set a range + move a card between categories; change **view-as** (Stacks/list/grid) + sort + local-filter; move a card between boards; collapse/pin the Search and Stats rails (board goes full-width); inline-edit description + **change deck art**; confirm edits **autosave** (updated-ago ticks).
- **Header + export/import:** click legality ✗ → popover names the offending cards/reasons; **clone** duplicates the deck; set **Shared** → open the `share_token` URL in a logged-out session → **read-only** deck view (no edit); **export** text / Arena / JSON and re-**import** the JSON into a new deck → **lossless round-trip** (categories/printings/boards intact); import a **plain-text + an Arena list** → fuzzy-resolve + **review step** flags unresolved lines before commit; import an **Archidekt CSV** → categories preserved; import an **Archidekt deck URL** (via the adapter) → deck pulled, and with the adapter blocked it **graceful-degrades** to "paste the export instead"; header **Import → add vs replace** both work.
- **Home dashboard:** after login, land on home → **your decks only** grid (commander art + color pips + format + Draft/Legal tag + updated-ago), unified **Cards↔Decks** search (Decks tab finds only your decks), New-Deck CTA, empty-state prompt on a fresh account; a friend's shared-link deck does **not** appear in the grid.
- **Card detail panel:** click a card → opens on **Card Info** (readable oracle text + printing/quantity/category controls); switch **printing** (art updates); switch to **More Info** (legality grid + rarity/EDHREC-rank/artist) and click the **set line → `set:<code>` search** runs in the Search panel; open **Rulings** (proves the on-demand rulings proxy + cache); from a bare card search the panel shows **Add to Deck** instead of deck controls.
- **Scryfall sync:** manual resync → `cards` populated; stop the proxy → local autocomplete still works (fallback).
- **Server:** `curl -I` app on `:8099`; `vermilion.cooldad.top` loads via tunnel; `deckbuilder-postgres` healthy (`pg_isready -p 5436`); service shows in lavender-dashboard.
