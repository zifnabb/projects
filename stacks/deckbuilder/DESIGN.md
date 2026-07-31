# Deckbuilder ("vermilion") — Visual & UX Design System

> The **visual/UX companion** to [PLAN.md](PLAN.md). PLAN.md owns *what* to build and *how it's wired* (architecture, data model, per-screen feature specs, wireframes, phasing). This document owns *how it looks and feels*: the design language, tokens, component library, resolved screen designs, theming architecture, motion, and accessibility. Section numbers here are independent of PLAN's; cross-references point at PLAN §N where a feature is specified.
>
> **Rendered companion:** an interactive HTML version of this system (live swatches, dark/light toggle, component states, screen mockups) is published as an Artifact — see the link shared alongside this doc. This Markdown file is the **canonical source**; the artifact is a rendering of it.
>
> **Status:** **implemented** across Phases 5–6 and live at `vermilion.cooldad.top` (tokens, components, both themes). Grounded in the three in-repo Archidekt reference shots (`ref_builder_groupby_type.png`, `ref_builder_groupby_categories.png`, `ref_deckbuilding_template.png`). Where the built UI has since diverged from a spec here (feedback pass 1 — Grid view, Game Changer chips, DFC flip control), the **code is the truth**; this doc records the intent.

---

## 1. Design principles

Five principles, derived from PLAN §1 and the "private, calm, no-community" posture. Every token and component choice below traces back to one of these.

1. **Archidekt feel, calmer surface.** Archidekt is the north-star for *layout and density* (columnar Stacks board, labelled toolbar, in-context panels — PLAN §3). We keep its information density but drop the visual noise of a commercial product: no ads, no social chrome, no Patreon banners, fewer competing accent colors. The result should read as a **focused personal tool**, not a marketplace.
2. **The card art is the hero; the UI is the frame.** MTG card art is vivid and busy. The chrome must recede — near-neutral surfaces, one restrained accent, generous dark canvas — so a wall of card art never fights the interface. This is the single biggest reason the default theme is dark.
3. **Robust core reads confident; enrichment reads tentative.** PLAN §1's "robust core, fragile enrichment quarantined" has a *visual* expression: core data (names, mana, types, legality) is rendered at full contrast and weight; enrichment that may be absent (salt, EDHREC, prices, combos) lives in visually-quieter "enrichment" treatments that can vanish without leaving a hole.
4. **Themeable from the first pixel.** Dark **and** light are first-class, not a retrofit (PLAN §4, hard requirement). Nothing is hard-coded to a theme; every surface, border, and text color is a token that resolves per theme. Contrast targets are met in *both*.
5. **Teach the syntax, don't hide it.** The Advanced search form "compiles to and displays back" Scryfall syntax (PLAN §8); the design treats generated syntax, mana symbols, and legality reasons as **legible teaching surfaces**, not opaque machinery.

---

## 2. Brand & identity

**Name / wordmark.** `VERMILION` — set in **Sanguine Frost** (a black-metal display face by Masyafi Studio), **all-caps**, in the vermilion accent color. Underlying text stays lowercase `vermilion` (screen-readers say the word naturally); `text-transform: uppercase` handles the display. Chosen deliberately as a point of tension: a dramatic gothic wordmark over a calm neutral UI — the logo has attitude, the tool stays quiet (principle 1) — and it suits MTG's darker aesthetic. It is a wordmark, not a logo lockup; no mascot. When an icon-only mark is needed (favicon, tab), use a **single vermilion mana-drop / pip glyph** on the dark surface.
- **Display-only.** Sanguine Frost is used *only* for the wordmark (hero, top-bar, nav, auth). Never for headings, body, or any running text — it is illegible below display sizes. All UI/oracle type stays Inter (§4).
- **Leading / overshoot (important).** The glyphs have heavy spiky overshoot well beyond the em box. Any wordmark instance needs **generous vertical room** — `line-height ≥ 1.35` plus a little vertical padding/margin — or the spikes collide with adjacent lines. Never set it tight.
- **Font asset + license.** Files live in [`brand/`](brand/): `Sanguine Frost.ttf` (35 KB), the license, and the specimen. For the app, convert to `woff2` and self-host under `/static/fonts` with an `@font-face` (§4/§10). **License = personal-use only** (Masyafi Studio) — fine for this private, self-hosted, non-commercial tool, but a paid commercial license would be required if vermilion ever shipped publicly. Substitute another display face if that ever changes.

**Why vermilion.** The subdomain (`vermilion.cooldad.top`) names the brand and hands us the accent: **vermilion** is a brilliant red-orange pigment. It differentiates us from Archidekt's amber-gold accent while staying in the same warm family that suits MTG's card frames. The accent is used *sparingly* — primary actions, active/selected state, focus, and the wordmark — never as a fill for large areas (principle 2).

**Tone of voice.** Terse, friendly, unfussy. Empty states and coach-marks (PLAN §7, §10, §11) are the only "chatty" surfaces; everything else is labels and values. No exclamation marks in system copy except genuine success moments (Draft→Legal flip).

---

## 3. Color system

Three layers, all expressed as CSS custom properties (§10): **(A) neutral UI palette** (theme-dependent), **(B) brand + semantic** (mostly theme-stable, with per-theme tuning), **(C) MTG domain colors** (WUBRG identity + rarity — theme-stable; the only per-theme value is the identity **tint alpha**, §3.4. The identity hexes were authored once and have not been contrast-tuned per theme.)

### 3.1 Neutral UI palette

The workhorse. Dark is the default. Values below are the *resolved* per-theme values behind the semantic tokens in §10.2.

**Dark theme (default)** — a warm-neutral near-black so card art pops and long sessions are easy on the eyes. Not pure `#000` (too harsh, no elevation headroom).

| Token role | Hex | Use |
|---|---|---|
| `canvas` | `#141416` | App background (behind everything) |
| `surface` | `#1C1C1F` | Panels, toolbar, cards-of-UI (deck cards, columns) |
| `surface-raised` | `#242428` | Popovers, modals, card-detail panel, menus |
| `surface-sunken` | `#101012` | Inset wells, search field interiors, board gutter |
| `border` | `#2E2E33` | Default hairline borders / dividers |
| `border-strong` | `#3C3C43` | Emphasized borders, input outlines |
| `text` | `#EDEDEF` | Primary text |
| `text-muted` | `#A0A0A8` | Secondary text, labels, "updated X ago" |
| `text-faint` | `#6A6A72` | Tertiary, placeholders, disabled, flavor text |

**Light theme** — warm paper, not clinical white; keeps the "calm" feel and prevents card art from looking like it's floating on a screen.

| Token role | Hex | Use |
|---|---|---|
| `canvas` | `#F4F2EE` | App background |
| `surface` | `#FBFAF7` | Panels, columns, deck cards |
| `surface-raised` | `#FFFFFF` | Popovers, modals, card-detail panel |
| `surface-sunken` | `#ECE9E3` | Inset wells, search interiors |
| `border` | `#DEDAD2` | Hairlines |
| `border-strong` | `#C7C1B6` | Input outlines |
| `text` | `#1E1D1B` | Primary text |
| `text-muted` | `#5F5C56` | Secondary |
| `text-faint` | `#928E86` | Tertiary / placeholder / flavor |

### 3.2 Brand accent — Vermilion ramp

A single ramp; the app uses a small slice of it. Tuned so `accent` meets ≥4.5:1 for its text pairing in both themes.

| Step | Hex | Role |
|---|---|---|
| `vermilion-50` | `#FDECE7` | Tint backgrounds (light theme selected rows) |
| `vermilion-100` | `#FBD3C7` | Subtle fills |
| `vermilion-300` | `#F0937A` | Hover tints, borders |
| `vermilion-500` | `#E8552E` | **Primary accent** — buttons, active tab, focus ring, wordmark |
| `vermilion-600` | `#D0421D` | Accent hover / pressed |
| `vermilion-700` | `#AE3315` | Accent active, light-theme text-on-tint |

- **Dark theme accent** = `vermilion-500` on dark surfaces (passes AA for the white button label).
- **Light theme accent** = `vermilion-600` (a touch deeper so it holds contrast on paper).
- **Accent is not MTG-Red.** MTG red identity (§3.4) is a distinct crimson; vermilion leans orange. They coexist (an orange UI framing a red deck, exactly like the reference shots) but never occupy the same token.

### 3.3 Semantic colors

Status meaning, consistent across the app. Each has a solid + a translucent "tint" variant (for row backgrounds / badges) generated at ~12% alpha.

| Token | Dark | Light | Meaning / primary use |
|---|---|---|---|
| `success` | `#3FB870` | `#1E9E57` | **Legal ✓**, Draft→Legal flip, "in range" |
| `warning` | `#E0A32E` | `#B77E12` | **Draft** state, over/under target range flag, soft advisories |
| `danger` | `#E5484D` | `#CE2C31` | **Illegal ✗**, banned/out-of-identity cards, destructive actions, lockout |
| `info` | `#4C8DF5` | `#2F6FE0` | Neutral notices, "syntax converted" hints, tips |
| `price` | `#4FB477` | `#2E9E5B` | The **green price pill** (matches Archidekt's convention; distinct enough from `success` in use — price is a pill with `$`, success is a check/tag) |

> **Draft vs Legal** is the app's most-repeated status pair (PLAN §6, §10, §11, §13). Rendered as pills: **Draft** = `warning` tint pill with a small dot; **Legal** = `success` tint pill with ✓. They share size/shape so the flip is a color change in place — a satisfying micro-moment (§9.3).

### 3.4 MTG color identity (WUBRG)

The domain palette. Every card, deck, and search filter carries a **color identity** — one or more of W/U/B/R/G, or Colorless, or Multicolor. This drives: the **color-pip bar** on deck cards (PLAN §10), **identity tint** on card rows in the Stacks board (visible in every reference shot as the colored frame behind each row), pips in mana costs, and the color filter in search.

Each identity color defines **four** values: a **pip fill**, **pip text/edge**, a **solid** (for bars/accents), and a **tint** (translucent, for row backgrounds and identity glows). Values below are theme-stable except where the tint alpha differs.

> **Contrast audit (2026-07-30), first ever run on these values.** Result: every rendered pip is **detectable** in both themes — `max(fill, ring)` clears 3:1 everywhere W/U/B/R/G/C render. Two caveats: (1) `ColorPipBar` uses the **`glyph`** token as the pip's *outer ring*, but `glyph` is specified as the *interior* text/edge color, so its polarity is wrong for one theme or the other — in dark, W/C/M rings sit at 1.3–2.3:1; in light, U/B/R/G rings sit at ~1.1:1. The pip survives on its fill either way, so this is fragility, not a failure. (2) **Real gap:** in the **light** theme the StatsSidebar color bars put `W solid` at **1.15:1** and `C solid` at **1.70:1** against the `--color-surface-sunken` track (G marginal at 2.81:1) — a white- or colorless-heavy deck's Cost/Production bar reads as empty, and unlike pips these segments have no ring to fall back on. Separately, touching segments are low-contrast against each other (R↔G **1.39:1**, B↔R 1.56, G↔C 1.66, U↔B 1.70); not a 1.4.11 violation for data series, but hairline track-colored separators would fix it.

| Identity | Pip fill | Pip glyph | Solid | Notes |
|---|---|---|---|---|
| **W** White | `#F7F3D8` | `#5B5637` | `#E4DCA8` | Warm parchment; needs a border in both themes (nearly invisible on light) |
| **U** Blue | `#2E7DC4` | `#EAF4FC` | `#2E7DC4` | |
| **B** Black | `#3A3540` | `#D6D0DA` | `#5A5361` | Pure black is invisible on dark canvas → a dark plum-grey stands in |
| **R** Red | `#D33B2E` | `#FBE7E2` | `#D33B2E` | MTG crimson; distinct from vermilion accent |
| **G** Green | `#2E9E5B` | `#EAF7EF` | `#2E9E5B` | |
| **C** Colorless | `#B9B4AE` | `#3A3833` | `#B9B4AE` | Also used for artifacts/Wastes |
| **M** Multicolor | `#D9A63A` | `#3A2F10` | `#D9A63A` | Gold — for 2+ color cards' pip-cluster fallback and gold frame |
| **Land** | `#B08A5E` | `#F2EADF` | `#B08A5E` | Neutral brown for the land grouping |

> **NOT IMPLEMENTED (audited 2026-07-30).** The identity-tint block below never shipped: the Stacks board went **art-forward** (overlapping card-image fans) instead of tinted text rows, so there is no per-row identity frame. `--identity-tint-alpha`, `--wubrg-m-*`, and `--wubrg-land-*` are **dead tokens** with zero consumers. Only `-fill`/`-glyph` (ColorPipBar) and `-solid` (StatsSidebar bars) are live. Decide whether to revive the tint or cut the spec.

**Identity tint (card-row frame).** In the Stacks board, each card row sits in a frame tinted by the card's identity — the headline visual texture of the whole app (see reference shots: red cards get warm-crimson frames, blue cards blue, etc.).
- Single-color card → tint = that color's `solid` at **14%** alpha (dark) / **10%** (light), with a 1px left border at the `solid` full color.
- Multicolor card → a **2-stop gradient** across the involved colors (WUBRG order) at the same alpha; left border becomes a thin gold (`M`) or gradient rule.
- Colorless / land → `C` / `Land` tint.
- Selected/focused card row → tint alpha steps up (+8%) and the left border thickens to 2px `accent`.

**Color-pip bar** (deck cards, PLAN §10) — a short horizontal bar of filled pips in WUBRG order for the deck's `color_identity`; colorless decks show a single `C` pip. Pips are `10px` circles, `pip fill` + 1px `pip glyph`-colored ring, `2px` gap.

### 3.5 Rarity

Used on the More Info tab (PLAN §9), printing selector, and set lines. Classic MTG rarity gem colors, tuned for both themes.

| Rarity | Dark | Light |
|---|---|---|
| Common | `#B9B4AE` | `#6A6660` |
| Uncommon | `#B7C7D3` (silver) | `#7C8B97` |
| Rare | `#D9B65B` (gold) | `#9A7E27` |
| Mythic | `#E07A3C` (orange-red) | `#C4531B` |
| Special/Bonus | `#D08BC4` (purple-pink) | `#A64C97` |

### 3.6 Color usage rules

- **One accent per view.** Vermilion marks the single most important action or the active selection. If two things are vermilion, one is wrong.
- **Identity color is data, never decoration.** Never tint a row/pip a color the card doesn't have.
- **Semantic colors never restyle.** `danger` is always the same red; don't invent a second red for a different "bad."
- **Enrichment is desaturated.** Enrichment rows (salt, EDHREC rank, combos) use `text-muted` labels and `surface-sunken` chips — visually a tier below core data (principle 3).

---

## 4. Typography

**Families** (self-hosted; no runtime CDN — matches PLAN §4's "no Node/third-party at runtime" posture):

- **Display (headings, labels, deck/card/column names):** `Cinzel` (OFL, variable) — a classical Roman inscriptional caps serif. **Locked.** Caps-only by nature (lowercase renders as small-caps), so it's used *only* for display surfaces, never for body or oracle text. Pairs deliberately with the Sanguine Frost wordmark (classical serif ↔ black-metal, both caps-forward) and carries the fantasy/mythic tone. Needs slight positive tracking (`≈+.01em`) and never sub-13px. Asset in [`brand/`](brand/); convert to `woff2` for the app.
- **Wordmark only:** `Sanguine Frost` (black-metal display face, all-caps) — the `VERMILION` wordmark and nothing else (§2). Never used for headings or running text.
- **Body + oracle / rules text:** `Libre Franklin` (OFL, variable) — a warm Franklin-Gothic-revival humanist sans. **Locked.** Chosen over Inter (which read too neutral) and over the serif candidates Alegreya / Crimson Pro: those two carried more theme but have lower x-heights, so at UI sizes they read optically smaller and softer — wrong for a data-dense tool with lots of small chrome. Libre Franklin keeps warmth *and* crispness at small sizes. Used for all body, chrome, controls, and the readable oracle text (larger size + looser leading via the `--oracle` treatment). Cinzel supplies all the atmosphere at the display level; the body face's job is legibility. Asset in [`brand/`](brand/); convert to `woff2` for the app. We do **not** imitate WotC's Beleren; legibility beats fidelity.
- **Mana & set symbols:** the open-source **[Mana font](https://mana.andrewgioia.com/)** (`mana-font`) for mana/tap/loyalty symbols and **[Keyrune](https://keyrune.andrewgioia.com/)** for set symbols. Both are icon-fonts, self-hosted, MIT/SIL — the standard solution for MTG web apps. Mana symbols render inline within oracle text and mana-cost strings (§5).
- **Numeric / mono (optional):** `ui-monospace, "SF Mono", monospace` for the raw Scryfall-syntax bar and JSON export preview (§8 search Syntax tab) — signals "this is machine syntax."

**Type scale** (1.20 minor-third-ish, rem @ 16px base):

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `display` | 28 / 34 | 700 | Wordmark, auth page title, empty-state headline |
| `h1` | 22 / 28 | 650 | Deck name in header, modal titles |
| `h2` | 18 / 24 | 600 | Section headers ("Your decks"), column group titles |
| `h3` | 15 / 20 | 600 | Card name (in panel), sub-section labels |
| `body` | 14 / 20 | 400 | Default UI text |
| `body-strong` | 14 / 20 | 600 | Emphasis, values |
| `oracle` | 15 / 23 | 400 | Card rules text (the readable treatment) |
| `label` | 12 / 16 | 600, +0.04em tracking, UPPERCASE | Toolbar group labels ("VIEW AS", "GROUP BY"), form labels |
| `caption` | 12 / 16 | 400 | "updated X ago", helper captions, price sub-lines |
| `micro` | 11 / 14 | 600 | Qty badges, pill text, collector numbers |

**Rules:**
- **Labels are the toolbar's grammar.** Archidekt's toolbar (reference shots) labels every control group in small caps above the control — we adopt `label` for exactly this (§6 toolbar).
- **Oracle text renders mana symbols inline** at the cap-height of the surrounding text; italic + `text-faint` for flavor text below a hairline (PLAN §9 wireframe).
- **Numerals:** enable tabular figures (`font-variant-numeric: tabular-nums`) for quantities, counts, prices, and curve axes so columns of numbers align.
- Never go below `micro` (11px). Qty badges and pips are the smallest legible elements.

---

## 5. Iconography & MTG symbols

- **UI icons:** a single lightweight outline set — [Lucide](https://lucide.dev/) (ISC license, tree-shakeable React components). Consistent `1.5px` stroke, `20px` default, `16px` in dense toolbars. Used for: search, close/lock (pin), undo/redo, settings gear, chevrons, board icons, clone, export/import, theme toggle (sun/moon), admin.
- **Mana symbols** (Mana font): mana costs `{2}{R}`, tap `{T}`, phyrexian, loyalty, generic. Rendered as circular pips matching §3.4 colors. In a mana-cost string they sit at end of the card name line (right-aligned) and within oracle text inline.
- **Set symbols** (Keyrune): the set glyph on the More Info set line, colored by rarity (§3.5).
- **Legality mark:** ✓ (`success`) / ✗ (`danger`) — a filled circle-check / circle-x, never a bare glyph, so it reads as a status chip.
- **Board icons:** small glyphs for Main / Side / Maybe / Command (crown for Command, matching Archidekt's commander crown in the reference shots).

**Rule:** icons always pair with a text label in primary navigation and the toolbar (Archidekt does this); icon-only is allowed only in the dense left status mini-rail (§6) and on repeated per-card controls (± qty, ⋯ menu), where a tooltip supplies the name.

---

## 6. Layout & structural system

### 6.1 Grid, spacing, radius, elevation

- **Spacing scale (4px base):** `2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48`. Tokens `space-1`…`space-12`. Toolbar and dense board use 8–12; page padding uses 16–24.
- **Radius:** `radius-sm 4px` (inputs, pills, qty badge), `radius-md 8px` (cards, panels, buttons), `radius-lg 12px` (modals, popovers), `radius-full` (pips, avatar). Card *art* keeps MTG's own corner radius (~4.8% — rendered by the image), so our container radius sits just outside it.
- **Elevation** (dark theme uses lighter-surface + subtle border, not big shadows — shadows read poorly on near-black; light theme uses soft shadows):
  - `e0` flat: `surface`, `1px border`.
  - `e1` raised (deck card hover, column): `surface`, `border`, tiny lift shadow on light only.
  - `e2` floating (popover, card-detail panel, menu): `surface-raised`, `border-strong`, `shadow-md`.
  - `e3` modal (New Deck, import review): `surface-raised`, `border-strong`, `shadow-lg` + scrim.
  - Scrim: `rgba(0,0,0,.5)` dark / `rgba(30,28,26,.35)` light.
- **Focus ring:** `2px` `accent` outline + `2px` offset, on every interactive element (§11 accessibility). Never removed, only restyled.

### 6.2 The three structural shells

Every screen is one of three shells. This keeps the app coherent as features slot in (PLAN's "design-in-now" ethos).

**A. App shell (authenticated).** Top bar (fixed) + content region.
- **Top bar** (height 56px, `surface`, bottom `border`): `vermilion` wordmark (left) · unified search (center, Cards ↔ Decks tabs — PLAN §10) · night-mode toggle · **+ New Deck** (accent button) · user menu (avatar/initials → theme, account, Invites*, Admin*, logout; * only when `is_admin`).
- Content region fills below.

**B. Builder shell (the workspace, PLAN §11).** The densest layout, modeled directly on the reference shots.
- **Deck header** (below top bar) — title (inline-edit) · updated · format · legality pill · size · tags · clone · export/import · visibility. (§7 Deck Builder, §9.x components.)
- **Control toolbar** (full-width, labelled groups): `[🔍 Card search]` (accent) · Quick add · View as · Group by · Sort by · Price sources (post-MVP, disabled-styled) · Local filter. Each group = small-caps `label` above a control (exactly the reference toolbar).
- **Left status mini-rail** (48px): legality ✓ · undo · redo · settings ⚙ · more ⋯ — icon-only, tooltips.
- **Center board** — the columnar Stacks region; **takes full width** because Search and Stats are collapsible rails, not permanent columns (PLAN §11 is explicit: NOT an always-on three-column layout).
- **Search panel (§8 PLAN)** & **Stats sidebar** — **collapsible/pinnable rails**: pinned = docked right/left alongside the board; unpinned = floating overlay (`e2`) summoned from the toolbar / an edge handle. Closing returns the board to full width.

**C. Focused shell (auth, shared read-only).** Centered single-column card on `canvas`, max-width ~440px (auth) / ~1100px (shared deck view). No top-bar chrome for logged-out surfaces beyond the wordmark.

### 6.3 The Stacks board (signature layout)

The board is a **horizontally-scrolling row of columns**; each column is one group (Category or Type — PLAN §11). This is the interaction the two reference shots demonstrate (Group by: Categories ⇄ Type on the same deck).

- **Column** (`e0`, width ~200px, min-content height): **column header** (§9.7) then a vertical stack of **card rows**.
- **Card row** in Stacks view: a **fanned/overlapping** strip — each row shows the card's **title bar** (name + mana cost) with the identity tint (§3.4); rows overlap ~72% so many fit; the **focused row expands** to reveal full art + oracle (as in the shots, where one card per column is shown full).
- **View-as** changes the row rendering, not the column structure: **Stacks** (fanned title bars, default) · **List** (one-line rows, no art) · **Grid** (full card images, wrap) · **Text/Compact** (dense text lines).
- **Column header** carries: group name (+ target range for Categories, e.g. "Ramp (8-12)") · Qty · Price (post-MVP, reserved) · per-column ⋯ menu. Under/over a Category's `target_min/max` shows a subtle `warning` flag (advisory only — never affects legality, PLAN §11).
- **Empty categories exist** (they're deck-level) and render as an empty labelled column — this is what makes a template-seeded deck open pre-structured (PLAN §11, `ref_deckbuilding_template.png`).

### 6.4 Responsive behavior

Target is **desktop-first** (deckbuilding is a large-screen activity; the reference is a 4K desktop). But it must not break on a laptop or tablet.

- **≥1280px** — full builder shell; pinned rails allowed alongside a multi-column board.
- **1024–1279px** — rails default to overlay (unpinned) so the board keeps room; toolbar labels may wrap to icon+tooltip if cramped.
- **768–1023px (tablet)** — single rail overlay at a time; board scrolls horizontally; top-bar search collapses to an icon that expands.
- **<768px (phone, best-effort)** — the app is usable but not optimized: board becomes a single vertical list of columns (stacked, not side-by-side); header controls collapse into a ⋯ menu; New Deck and Card panel become full-screen sheets. **Explicitly out of MVP polish scope** (private tool, desktop use) — but the token/flex system must not *prevent* it. Note this as an open item.

---

## 7. Component library

Each component: purpose, anatomy, key states, and the tokens it uses. Ordered roughly foundational → composite. (Rendered states live in the Artifact.)

### 7.1 Buttons
- **Variants:** `primary` (accent fill, white/`#fff` label — Card search, Create, Sign in), `secondary` (surface fill, `border-strong`, `text`), `ghost` (transparent, text only — toolbar actions, menu items), `danger` (danger fill/outline — deactivate, delete category), `icon` (square, icon-only, tooltip).
- **Sizes:** `sm` 28px, `md` 34px (default, matches toolbar height in shots), `lg` 40px (auth submit).
- **States:** default / hover (accent→`vermilion-600`; secondary→`surface-raised`) / active(pressed) / focus (ring §6.1) / disabled (`text-faint`, no border) / loading (spinner replaces label, width held).

### 7.2 Inputs & form controls
- **Text input / search field:** `surface-sunken` interior, `border-strong` outline, `radius-sm`; leading icon slot (search), trailing slot (clear ✕, 🎲 re-roll for deck name); focus = accent ring + border. Placeholder in `text-faint`.
- **Select / dropdown:** button-styled trigger with chevron (the View-as / Group-by / Sort-by controls); menu is `e2`. Selected item shows a check + accent text.
- **Toggle / switch:** for "legal cards only", "Start from deckbuilding template" (default-on), night-mode. On = accent track. Always paired with a `label`.
- **Segmented control:** for board picker (Main/Side/Maybe/Command) and view-as when few options — a pill row with the active segment in `surface-raised` + accent underline.
- **Checkbox / radio:** standard, accent when checked.
- **Stepper (± quantity):** `[− n +]` — the most-repeated control (every card). Compact `sm`, `micro` numeral, tabular. Long-press / hold to repeat; disabled − at 1 (or 0 → removes).

### 7.3 Tabs (the extensible tab-shell)
Used in **two** places with one component (PLAN §8 search, §9 card detail): a horizontal tab strip with an underline indicator that **slides** to the active tab (§9.3 motion).
- **Search tabs:** Standard · Advanced · Syntax (+ post-MVP EDH Recs / Combos / Landbase / **Synergy** slot in without layout change — the shell is built for it).
- **Card-detail tabs:** Card Info · More Info · Rulings (+ post-MVP Printings / EDHREC / Combos).
- Panel is **pinnable** (Close/Lock affordance top-right — PLAN §8): pinned docks the rail; unpinned floats.
- Active tab: `text` + accent underline; inactive: `text-muted`; disabled/gated (e.g. EDH Recs with no commander) shows a tooltip "set a commander to use this."

### 7.4 Pills, tags & badges
- **Legality pill:** `Legal` (success tint, ✓) / `Draft` (warning tint, dot) — **clickable** when ✗/Draft → opens the "why" popover (§7.10, PLAN §13). Same footprint so the flip animates in place.
- **User tag chip:** `surface-sunken`, `text-muted`, removable ✕ on hover (deck header, deck cards). Add via a `+ tag` ghost affordance.
- **System tag:** visually distinct from user tags — no ✕ (not user-editable), a tiny "auto" dot (PLAN §6).
- **Price pill:** `price` green, `$` prefix, `micro`, tabular — on column headers & card panel (values reserved/blank until pricing ships, PLAN §16; render the pill skeleton, not a fake number).
- **Qty badge:** top-left of a card row, `micro`, `surface-raised` on a dark scrim so it reads over art.
- **Rarity gem:** small diamond in the rarity color (§3.5) on set lines / printing rows.
- **Count-vs-range chip:** column header "7/8" — neutral when in range, `warning` when under `target_min` / over `target_max`.

### 7.5 Color-pip bar & mana cost
- **Color-pip bar:** WUBRG-ordered filled pips for a deck's identity (§3.4). On deck cards and the deck header. Colorless → single `C` pip.
- **Mana cost string:** right-aligned pip sequence on the card name line, Mana-font symbols at cap height. Split/DFC costs shown as `A // B`.
- **Mana pip in oracle text:** inline, baseline-aligned, same rendering.

### 7.6 The Card (three distinct "card" components — disambiguated)
MTG makes "card" overloaded. Three components:
1. **GameCard** — a rendering of an actual MTG card. Modes: **art-crop** (grid/deck-card art), **full** (image with rounded MTG frame, hotlinked from Scryfall CDN — PLAN §5, never stored), **title-bar** (Stacks fanned row: name + mana + identity tint + qty badge). Selected/focused → accent left-border + raised tint (§3.4).
2. **DeckCard** — the dashboard tile (PLAN §10): commander art (or `deck_art_card_id`) as the top image, then name (`h3`), **color-pip bar**, format · size · legality pill · user tags · "updated X ago". Hover = `e1` lift + subtle accent border. Click → builder.
3. **UICard / Panel** — a generic surfaced container (`e0`/`e2`) used for columns, the stats sidebar, popovers.

### 7.7 Column header (Stacks)
Group name (`h3`, + target range for Categories) · qty (`micro`) · price pill (reserved) · ⋯ menu (rename · set range · recolor · delete · move). Under/over-range → `warning` count chip + a hairline top-accent in `warning`. A Category can carry an optional `color_tag` (§ PLAN §6) rendered as a 3px top border on the column.

### 7.8 Card detail panel (composite, PLAN §9)
The click-any-card overlay. Anatomy: **left** = GameCard `full` (selected printing) + price sub-line (reserved); **right** = tab strip (Card Info / More Info / Rulings) over a scroll region. **Context-adaptive:** in-deck shows ±qty / printing select / board segmented / category select / commander star; bare-search shows a single **+ Add to Deck** primary button instead. `e2` floating, pinnable, theme-aware, Close ✕ top-right. Oracle text uses the `oracle` treatment; flavor italic/`text-faint` below a hairline. Enrichment rows (§3.6) render only if their source resolved.

### 7.9 Stats sidebar (composite, PLAN §11)
Collapsible/pinnable rail. Widgets (all computed locally — no external calls):
- **Mana curve** — a small vertical bar chart (CMC buckets 0–7+), bars in `text-muted`, hovered bar → accent + count tooltip. Follow the `dataviz` skill for the chart itself (single-series categorical; one hue, not a rainbow).
- **Color cost & production** — two horizontal stacked bars: *cost* (from `mana_cost`) and *production* (from `produced_mana`), segmented in WUBRG identity colors (§3.4). This is the one place multiple identity colors legitimately appear together.
- **Type counts / category counts (vs target)** — a compact labelled list with count chips (in-range/over/under coloring, §7.4).
- **Totals** — avg + total mana value; card count vs format target.

### 7.10 Popovers, menus, modals, toasts, coach-marks
- **Legality "why" popover** (`e2`) — the clickable legality pill opens it: a list of reasons (out-of-identity cards, banned, singleton violation, wrong size, missing commander), each row linking to the offending card(s) (PLAN §13). Danger-tinted rows.
- **Menu** (`e2`) — user menu, column ⋯, export ▾, card ⋯.
- **Modal** (`e3` + scrim) — New Deck (PLAN §12), Import review (PLAN §13), confirmations. Trap focus; ✕ + Esc to close; Cancel/confirm footer.
- **Import review** — a table of parsed lines with **unresolved/ambiguous rows flagged** (danger/warning), fix-or-skip per row, and an `add | replace | new deck` action footer (PLAN §13). The one genuinely data-dense modal.
- **Toast** — bottom-center, `e2`, auto-dismiss; success (Draft→Legal, "deck cloned"), danger (import failed → graceful-degrade hint). Never for routine autosave (autosave is silent; the header "updated X ago" is the only confirmation — PLAN §11).
- **Coach-marks** — first-run spotlights (PLAN §7, §10, §11): a dimmed scrim with a cutout around the target (open Search · set commander · view controls) + a small `e2` bubble. Dismissible, one-time (persist per user), never block.

### 7.11 Empty & loading states
- **Empty (no decks)** — centered `display` headline + friendly line + big **+ New Deck** + first-run coach-mark (PLAN §10). Warm, not sterile.
- **Empty board (template OFF)** — Scryfall-style clean canvas + "How does this work?" help + coach-marks (PLAN §11).
- **Skeletons** — deck-card grid and card-detail use shimmer skeletons in `surface-sunken`; the board shows placeholder columns. **Never a bare spinner on first paint** (feels broken); spinners only for in-place actions (button loading, search fetch).
- **Enrichment-down** — a quiet single line in `text-faint` ("rulings unavailable", "EDHREC offline") — never an error banner (principle 3, graceful-degrade).

---

## 8. Screen designs (resolved)

Each screen: the shell it uses, layout intent, and design-specific notes beyond PLAN's wireframe. (PLAN owns the feature spec; this owns the visual resolution.)

### 8.1 Auth — Sign in / Register (Focused shell, PLAN §15)
Centered ~440px card on `canvas`; `vermilion` wordmark above. Single-column fields, `lg` primary submit. Register only via `/register?invite=<token>` (no open link). Rate-limit lockout renders as an inline `caption` under the button in `danger` ("too many attempts — try again in 4:59"), never a modal. No user-enumeration cues (generic messaging). This is one of only two logged-out surfaces (the other is the shared deck view).

### 8.2 Home dashboard (App shell, PLAN §10)
Top bar + a **deck-card grid** (`DeckCard`, §7.6) of *your* decks, `h2` "Your decks" with sort/filter controls right-aligned. Unified search in the top bar (Cards ↔ Decks). Empty state §7.11. **No community anything.** Friends' shared decks never appear here (link-only). Grid: 4-up ≥1280px, responsive down to 1-up. "View all →" when it overflows.

### 8.3 New Deck (Modal `e3`, PLAN §12)
Compact modal, not a page. Fields top-to-bottom: **Name** (with 🎲 re-roll placeholder — a randomized MTG name shown live, persisted if left blank) · **Format** (Commander default, ⓘ inline rules info) · **Commander** (shown when format allows; "legal only" toggle default-on; optional) · **Start from deckbuilding template** (toggle **default ON**, one-line bucket preview) · **▸ Extra Options** (collapsed: visibility · description · art). Footer `Cancel` / `Create`. Create → builder.

### 8.4 Deck builder (Builder shell, PLAN §11) — the centerpiece
Realizes §6.2-B and §6.3. Design notes:
- **Density matches the reference shots** but with our calmer palette: same column widths and fanned rows, our `surface`/`border`/tint tokens instead of Archidekt's.
- **Group-by Categories ⇄ Type** is the headline transition — columns re-flow with a coordinated layout animation (§9.3), FLIP-style so cards visibly move to their new columns.
- **Full-width board:** collapsing Search/Stats rails returns the board to edge-to-edge (the reference shots show exactly this — no permanent side columns).
- **Autosave is silent;** "updated X ago" in the header is the only tick.
- Template-seeded decks open **grouped by Categories** with labelled skeleton columns showing count-vs-range; from-scratch decks open **grouped by Type** (avoids an empty "Uncategorized" dump — PLAN §11).

### 8.5 Card detail panel (Overlay `e2`, PLAN §9)
§7.8. Opens on **Card Info**. Printing switch updates the art (a soft cross-fade, §9.3). Set line on More Info is a link → runs `set:<code>` in the Search panel. Rulings tab lazy-fetches on open (spinner in-tab, then cached).

### 8.6 Search panel (Rail/overlay, PLAN §8)
Tab-shell §7.3. **Advanced** form compiles to a **live syntax preview** shown in a `mono` read-only strip beneath the form ("we auto-convert to Scryfall syntax" info line above it) — the teaching surface (principle 5). Results render as `GameCard` art-crop grid; each → card detail panel (bare-search mode → Add to Deck).

### 8.7 Shared read-only deck view (Focused shell, PLAN §13)
Public, token-gated, **no edit chrome**: wordmark + deck name + color-pip bar + the board (read-only, Stacks/List toggle) + stats. No toolbar, no ± controls, no login required. A visibly *reduced* version of the builder — same tokens, stripped affordances — so it's obviously "view-only."

### 8.8 Admin panel (App shell, PLAN §15)
Minimal, table-driven: **Invites** (mint → copyable `/register?invite=` link, expiry, note; list pending/used; revoke) and **Users** (list: email · name · created · last-login; deactivate/reactivate · mint reset link · admin toggle with never-zero-admins guard). Plain tables, `danger` for destructive row actions with confirm. No charts.

### 8.9 Synergy tab (post-MVP, PLAN §14) — designed-for-now
The signature surface slots into the search tab-shell (§7.3) with **zero layout change**. Presentation: one scrolling panel of **collapsible labelled lane strips** (Supertype · Tribe · Produces-mana · Keywords · Reprints · Otag/function · Combos+similar+budget). Each lane = a horizontal `GameCard` strip + count; expand/collapse persists; dead-source lanes collapse quietly (graceful-degrade). Designed now so the tab-shell, lane-strip component, and the template-fill loop entry point ("find more Ramp in your colors" from an under-filled column) don't require rework.

---

## 9. Motion & interaction

Restraint over spectacle (principle 1 — calm tool). Motion clarifies state change; it never decorates.

### 9.1 Timing & easing
- **Durations:** `fast 120ms` (hovers, toggles, tooltips), `base 200ms` (panels, tabs, popovers), `slow 320ms` (board re-group / FLIP). 
- **Easing:** `ease-out` (`cubic-bezier(.2,.8,.2,1)`) for enter; `ease-in` for exit; a gentle spring only for the ± stepper feedback.
- **`prefers-reduced-motion`:** honor it — collapse all transforms to instant opacity fades; the FLIP re-group becomes an immediate re-layout.

### 9.2 State transitions
- Hover/focus: `fast` color + border. Buttons don't move on hover (no jump); they change color + show focus ring.
- Rail pin/unpin: `base` slide + fade; board reflows to fill.
- Card detail / modal: `base` scale-from-98%+fade in, scrim fades with it.

### 9.3 Signature moments (worth the polish)
- **Draft → Legal flip:** the header legality pill morphs `warning`→`success` with a ✓ draw-on and a one-shot subtle glow; a single success toast. This is the app's reward moment — the whole "robust core" pays off here.
- **Group-by re-flow:** FLIP animation so cards visibly travel from old columns to new (Categories ⇄ Type). `slow`, reduced-motion → instant.
- **Printing swap:** card art cross-fades `base` when a new printing is chosen (§8.5).
- **Add-to-deck:** the added card briefly pulses its target column header count.

### 9.4 Input & keyboard
- **Quick add** `Cmd/Ctrl+'` focuses the Quick-add field (matches the reference shots' "Sol Ring (Cmd + ')" hint).
- Card panel: `Esc` closes; `←/→` cycle printings when the selector is focused.
- Search: `Enter` runs full search; `Cmd+K` opens the top-bar unified search from anywhere.
- Steppers, tabs, menus fully keyboard-operable (§11).
- Drag-to-add from search into a column supported, but **quick-add and click-add are the primary paths** (drag is an enhancement, never the only way).

---

## 10. Theming architecture

Dark + light are peers (principle 4). Implementation matches PLAN §4's "CSS variables + React theme context, persisted per user."

### 10.1 Mechanism
- A `data-theme="dark|light"` attribute on `:root` (or `<html>`). All tokens are CSS custom properties defined under `:root[data-theme="dark"]` and `:root[data-theme="light"]`.
- **React `ThemeProvider` context** exposes `theme` + `setTheme`; the night-mode toggle (top bar + account settings) flips it. Persist to `users.theme_pref` (server) and mirror to `localStorage` for instant paint before hydration (avoid a flash).
- **First paint:** an inline pre-hydration script reads `localStorage`/`prefers-color-scheme` and sets `data-theme` before React mounts, so there's no theme flash. Default = dark; if no stored pref, follow `prefers-color-scheme`, else dark.

### 10.2 Token tiers (naming)
Two tiers, so components never reference raw hex:
1. **Primitive tokens** — raw ramps: `--vermilion-500`, `--wubrg-r-solid`, `--gray-900`, etc. (§3 tables). Theme-independent.
2. **Semantic tokens** — what components use: `--color-canvas`, `--color-surface`, `--color-text`, `--color-accent`, `--color-success`, `--color-border`, `--identity-r-tint`, `--space-4`, `--radius-md`, `--font-oracle`, `--elevation-2`, `--motion-base`. Each theme block maps semantic → primitive.

```css
:root[data-theme="dark"]{
  --color-canvas:#141416; --color-surface:#1C1C1F; --color-surface-raised:#242428;
  --color-border:#2E2E33; --color-text:#EDEDEF; --color-text-muted:#A0A0A8;
  --color-accent:var(--vermilion-500); --color-success:#3FB870; --color-danger:#E5484D; /* … */
}
:root[data-theme="light"]{
  --color-canvas:#F4F2EE; --color-surface:#FBFAF7; --color-surface-raised:#FFFFFF;
  --color-border:#DEDAD2; --color-text:#1E1D1B; --color-text-muted:#5F5C56;
  --color-accent:var(--vermilion-600); --color-success:#1E9E57; --color-danger:#CE2C31; /* … */
}
```

- **Rule:** components reference **only** semantic tokens. A new theme (e.g. a future high-contrast or OLED-black variant) is one more `[data-theme]` block — zero component changes.
- **MTG identity tints** are semantic too (`--identity-{w,u,b,r,g,c,m,land}-solid` / `-tint`) so the tint alpha can differ per theme (§3.4).

---

## 11. Accessibility

Non-negotiable, in both themes.

- **Contrast:** body text ≥ 4.5:1, large text / UI glyphs ≥ 3:1, against their actual surface — verified in dark **and** light. The neutral palettes (§3.1) and accent steps (§3.2) are chosen to pass. **White (W) identity** and **price/success greens** are the danger spots — W always gets a border; greens are darkened in light theme.
- **Never color-only:** legality is ✓/✗ *glyph* + color; Draft/Legal is text + color; identity is pip *position/letter* + color; over/under-range is a number + color. A colorblind user never loses meaning. (Mana pips carry their letter for exactly this reason.)
- **Focus:** visible `accent` focus ring on every interactive element (§6.1); logical tab order; focus trapped in modals and returned on close.
- **Keyboard:** full operation without a mouse — tabs, menus, steppers, board navigation, search (§9.4). Drag-to-add has a keyboard/click equivalent.
- **Screen readers:** semantic HTML + ARIA — mana costs get `aria-label` ("two generic, one red"), legality pill announces state + reason count, the board uses list semantics, live-regions announce autosave/Draft→Legal and search result counts. Card art `alt` = card name + set.
- **Motion:** `prefers-reduced-motion` respected (§9.1).
- **Targets:** interactive hit areas ≥ 32×32px even where the visual is smaller (qty steppers, pips-as-buttons).
- **Zoom / reflow:** layout survives 200% zoom (rails become overlays, board scrolls) without loss of function.

---

## 12. Implementation notes (maps to the locked stack)

Aligns with PLAN §4 (React SPA, Vite+TS, served static by FastAPI) and §17 build phasing.

- **Styling approach:** CSS custom properties (§10) + **CSS Modules** or a lightweight utility layer; no heavy runtime CSS-in-JS (keeps the static bundle lean, matches "no Node at runtime"). A single `tokens.css` holds primitives + both theme blocks.
- **Component primitives:** consider **Radix UI** (unstyled, accessible: tabs, dialog, popover, dropdown, toggle, tooltip) styled with our tokens — it hands us §11's focus-trapping/keyboard/ARIA for free on the composite components (tabs, modals, menus, card panel). This is a suggestion, not locked.
- **Icons:** Lucide-react (§5). **Mana/set fonts:** self-host `mana-font` + `keyrune` under `/static/fonts` (§4/§5).
- **Charts:** the stats sidebar's mana curve & color bars are small and bespoke — hand-rolled SVG following the `dataviz` skill is lighter than pulling a charting lib; revisit only if more charts appear.
- **Suggested front-end structure** (not prescriptive):
  - `src/styles/tokens.css` · `src/theme/ThemeProvider.tsx`
  - `src/components/ui/` (Button, Input, Tabs, Pill, Menu, Modal, Toast, Stepper…)
  - `src/components/mtg/` (ManaCost, ColorPipBar, GameCard, DeckCard, LegalityPill, RarityGem…)
  - `src/features/{home,newdeck,builder,cardpanel,search,auth,admin}/`
- **Phasing tie-in:** theming + the `ui/` + `mtg/` primitive components land in PLAN §17 **phase 5 (UI)**, but `tokens.css` + `ThemeProvider` should be scaffolded in **phase 0** so nothing is built un-tokenized (retrofitting theming is the exact pain PLAN §4 calls out).

---

## 13. Design decisions & open items

**Decisions taken in this doc (proposing; confirm or override):**
- **Accent = vermilion red-orange** (`#E8552E` dark / `#D0421D` light), derived from the brand name — distinct from Archidekt's amber and from MTG-Red.
- **Default theme = dark**, following `prefers-color-scheme` when no stored pref.
- **Type (locked):** `Cinzel` display (headings/labels/names) + `Libre Franklin` body & oracle (both OFL, in `brand/`) + Mana font + Keyrune (symbols) + optional mono for syntax/JSON. Inter dropped (too neutral); serif body candidates (Alegreya, Crimson Pro) dropped (lower x-height → read too small in dense UI). No attempt to imitate Beleren.
- **Wordmark = Sanguine Frost, all-caps** (§2) — locked. Display-only, personal-use license (asset in `brand/`), needs ≥1.35 line-height due to glyph overshoot.
- **Icons:** Lucide. **Primitives:** Radix — **confirmed 2026-07-19** (unstyled, skinned with our tokens; charts stay bespoke SVG).
- **Desktop-first**, tablet-graceful, phone best-effort (§6.4) — **confirmed 2026-07-19** (phone stays out of MVP polish scope; architecture must not preclude it).

**Open items (need a call before/while building the relevant phase):**
- **Font licensing/self-hosting** — Inter + Mana + Keyrune are open-licensed, self-host fine. **Sanguine Frost (wordmark) is personal-use only** — acceptable for this private tool (resolved), but flagged as the one non-open face: it must be swapped if vermilion ever goes public/commercial.
- ~~**Radix vs hand-rolled primitives**~~ — **RESOLVED 2026-07-19: Radix** for behavioral primitives (tabs/dialog/popover/menu/tooltip/toggle), skinned with our tokens; bespoke for all visuals (card, Stacks board, pip bars, charts).
- **Stacks fan density / row overlap %** — tune against real card counts once the board exists (the reference uses ~72%; verify legibility of the name bar).
- **Light-theme card-art treatment** — card art is designed for dark frames; on the light theme, confirm the identity tint + border keep cards from "floating." (Lean: a subtle `surface`-colored mat behind full-card images in light theme.)
- ~~**Phone board layout**~~ (§6.4) — **RESOLVED 2026-07-19: desktop-first, phone best-effort** (stacked vertical columns, out of MVP polish scope; token/flex system must keep it *possible* to promote later).
- **Deck-card image source** — commander art crop vs full-card thumbnail for the dashboard tile (lean: art-crop for a cleaner grid).
- **High-contrast / OLED-black theme** — worth a third `[data-theme]` block post-MVP? (Architecture already supports it.)

---

## 14. Reference lineage (visual)

Per-source visual borrowings, complementing PLAN §3's feature lineage:
- **Archidekt** — the whole builder *density and layout*: labelled toolbar groups, columnar Stacks board with fanned rows, per-card ±/⋯ overlay controls, left status mini-rail, green price pills, commander crown, column ⋯ menus. Our version keeps the structure, swaps the palette to the calmer vermilion/neutral tokens.
- **Moxfield** — the **readable oracle text** treatment (our `oracle` type token, §4/§7.8) and the unified Cards↔Decks home search.
- **Scryfall** — the clean empty-deck canvas, the Advanced-form → syntax teaching surface (§8.6), the format rules-info tooltip, and the calm neutral card-detail right rail.
- **Ours (new)** — the vermilion identity, the calm no-community reduction, the collapsible-rails (not fixed-3-column) builder, and the Synergy lane-strip layout (§8.9).
