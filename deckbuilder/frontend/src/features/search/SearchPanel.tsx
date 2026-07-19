/**
 * Search panel (PLAN §8 / DESIGN §8.6) — the extensible tab-shell. MVP tabs:
 * Standard (box + quick filters), Advanced (form → compiled Scryfall syntax,
 * shown live as a teaching strip), Syntax (raw query). Results are GameCards
 * with a hover +Add; color-identity/legality aware via the deck context.
 */
import { useEffect, useMemo, useState, type FormEvent } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { GameCard } from "../../components/mtg/GameCard";
import type { DeckFull } from "../../lib/types";
import {
  useCardSearch,
  useCompiledQuery,
  type AdvancedFilters,
  type SearchCard,
} from "./api";
import styles from "./SearchPanel.module.css";

function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function Results({
  query,
  onAdd,
}: {
  query: string;
  onAdd: (card: SearchCard) => void;
}) {
  const search = useCardSearch(query);
  const pages = search.data?.pages ?? [];
  const cards = pages.flatMap((p) => p.results);
  const first = pages[0];

  if (!query.trim()) {
    return <p className={styles.emptyNote}>Search to see results.</p>;
  }
  if (search.isLoading) {
    return <p className={styles.emptyNote}>Searching…</p>;
  }
  if (search.isError) {
    return <p className={styles.emptyNote}>Search failed — try again.</p>;
  }
  if (cards.length === 0) {
    return (
      <p className={styles.emptyNote}>
        No cards found{first?.warning ? ` — ${first.warning}` : ""}.
      </p>
    );
  }

  return (
    <>
      <div className={styles.resultsMeta}>
        {first?.total ?? cards.length} cards
      </div>
      {first?.degraded && (
        <div className={styles.warning}>
          Scryfall unavailable — showing local name matches only.
        </div>
      )}
      {first?.warning && <div className={styles.warning}>{first.warning}</div>}
      <div className={styles.resultsGrid}>
        {cards.map((card) => (
          <div key={card.oracle_id} className={styles.resultCard}>
            <GameCard card={card} />
            <div className={styles.addOverlay}>
              <Button variant="primary" size="sm" onClick={() => onAdd(card)}>
                + Add
              </Button>
            </div>
          </div>
        ))}
      </div>
      {search.hasNextPage && (
        <div className={styles.loadMore}>
          <Button
            variant="secondary"
            size="sm"
            loading={search.isFetchingNextPage}
            onClick={() => search.fetchNextPage()}
          >
            Load more
          </Button>
        </div>
      )}
    </>
  );
}

const CMP_OPS = ["=", "!=", ">", "<", ">=", "<="];
const TYPE_OPTIONS = [
  "",
  "creature",
  "instant",
  "sorcery",
  "artifact",
  "enchantment",
  "planeswalker",
  "land",
  "battle",
];

export function SearchPanel({
  deck,
  onClose,
  onAdd,
}: {
  deck: DeckFull;
  onClose: () => void;
  onAdd: (card: SearchCard) => void;
}) {
  const identity = deck.color_identity.join("").toLowerCase();

  /* ---- Standard tab ---- */
  const [stdText, setStdText] = useState("");
  const [stdType, setStdType] = useState("");
  const [myColors, setMyColors] = useState(true);
  const [legalOnly, setLegalOnly] = useState(true);
  const [stdQuery, setStdQuery] = useState("");

  function runStandard(e: FormEvent) {
    e.preventDefault();
    const parts = [stdText.trim()];
    if (stdType) parts.push(`t:${stdType}`);
    if (myColors && identity) parts.push(`id<=${identity}`);
    if (legalOnly && deck.format === "commander") parts.push("legal:commander");
    setStdQuery(parts.filter(Boolean).join(" "));
  }

  /* ---- Advanced tab ---- */
  const [adv, setAdv] = useState<AdvancedFilters>({});
  const [advQuery, setAdvQuery] = useState("");
  const debouncedAdv = useDebouncedValue(adv);
  const hasAdvInput = useMemo(
    () => Object.keys(debouncedAdv).length > 0,
    [debouncedAdv],
  );
  const compiled = useCompiledQuery(debouncedAdv, hasAdvInput);
  const compiledQuery = compiled.data?.query ?? "";

  function setAdvField<K extends keyof AdvancedFilters>(
    key: K,
    value: AdvancedFilters[K] | undefined,
  ) {
    setAdv((prev) => {
      const next = { ...prev };
      if (
        value == null ||
        value === "" ||
        (typeof value === "object" && !Array.isArray(value) &&
          Object.values(value).every((v) => !v))
      ) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }

  function runAdvanced(e: FormEvent) {
    e.preventDefault();
    if (compiledQuery) setAdvQuery(compiledQuery);
  }

  /* ---- Syntax tab ---- */
  const [rawInput, setRawInput] = useState("");
  const [rawQuery, setRawQuery] = useState("");

  function runSyntax(e: FormEvent) {
    e.preventDefault();
    setRawQuery(rawInput.trim());
  }

  return (
    <aside className={styles.panel} aria-label="Card search">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>Card search</h2>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onClose}
          aria-label="Close search"
        >
          <X size={16} />
        </button>
      </div>

      <Tabs.Root defaultValue="standard" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Tabs.List className={styles.tabList} aria-label="Search mode">
          <Tabs.Trigger className={styles.tab} value="standard">
            Standard
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="advanced">
            Advanced
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="syntax">
            Syntax
          </Tabs.Trigger>
        </Tabs.List>

        {/* Standard */}
        <Tabs.Content value="standard" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <form className={styles.tabBody} onSubmit={runStandard}>
            <input
              className={styles.input}
              placeholder="Search cards…"
              value={stdText}
              onChange={(e) => setStdText(e.target.value)}
              aria-label="Search text"
            />
            <div className={styles.row}>
              <div>
                <label className={styles.fieldLabel}>Type</label>
                <select
                  className={styles.select}
                  style={{ width: "100%" }}
                  value={stdType}
                  onChange={(e) => setStdType(e.target.value)}
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t ? t[0].toUpperCase() + t.slice(1) : "Any type"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {identity && (
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={myColors}
                  onChange={(e) => setMyColors(e.target.checked)}
                />
                My colors only ({deck.color_identity.join("")})
              </label>
            )}
            {deck.format === "commander" && (
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={legalOnly}
                  onChange={(e) => setLegalOnly(e.target.checked)}
                />
                Legal cards only
              </label>
            )}
            <Button type="submit" variant="primary" size="sm">
              Search
            </Button>
          </form>
          <div className={styles.results}>
            <Results query={stdQuery} onAdd={onAdd} />
          </div>
        </Tabs.Content>

        {/* Advanced */}
        <Tabs.Content value="advanced" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <form className={styles.tabBody} onSubmit={runAdvanced}>
            <div className={styles.row}>
              <input
                className={styles.input}
                placeholder="Name"
                value={adv.name ?? ""}
                onChange={(e) => setAdvField("name", e.target.value)}
              />
              <input
                className={styles.input}
                placeholder="Rules text"
                value={adv.text ?? ""}
                onChange={(e) => setAdvField("text", e.target.value)}
              />
            </div>
            <div className={styles.row}>
              <input
                className={styles.input}
                placeholder="Type line (e.g. legendary creature)"
                value={adv.type ?? ""}
                onChange={(e) => setAdvField("type", e.target.value)}
              />
            </div>
            <div className={styles.row}>
              <div>
                <label className={styles.fieldLabel}>Identity (e.g. wub)</label>
                <input
                  className={styles.input}
                  placeholder={identity || "colors"}
                  value={adv.color_identity?.colors ?? ""}
                  onChange={(e) =>
                    setAdvField(
                      "color_identity",
                      e.target.value
                        ? {
                            colors: e.target.value,
                            mode: adv.color_identity?.mode ?? "at-most",
                          }
                        : undefined,
                    )
                  }
                />
              </div>
              <div>
                <label className={styles.fieldLabel}>Mode</label>
                <select
                  className={styles.select}
                  style={{ width: "100%" }}
                  value={adv.color_identity?.mode ?? "at-most"}
                  onChange={(e) =>
                    adv.color_identity &&
                    setAdvField("color_identity", {
                      ...adv.color_identity,
                      mode: e.target.value as "exactly" | "including" | "at-most",
                    })
                  }
                >
                  <option value="at-most">At most</option>
                  <option value="including">Including</option>
                  <option value="exactly">Exactly</option>
                </select>
              </div>
            </div>
            <div className={styles.row}>
              {(["cmc", "power", "toughness"] as const).map((stat) => (
                <div key={stat}>
                  <label className={styles.fieldLabel}>
                    {stat === "cmc" ? "Mana value" : stat}
                  </label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <select
                      className={styles.select}
                      value={adv[stat]?.op ?? "="}
                      onChange={(e) =>
                        adv[stat] &&
                        setAdvField(stat, { ...adv[stat]!, op: e.target.value })
                      }
                    >
                      {CMP_OPS.map((op) => (
                        <option key={op}>{op}</option>
                      ))}
                    </select>
                    <input
                      className={styles.input}
                      style={{ width: 56 }}
                      inputMode="numeric"
                      value={adv[stat]?.value ?? ""}
                      onChange={(e) =>
                        setAdvField(
                          stat,
                          e.target.value
                            ? { op: adv[stat]?.op ?? "=", value: e.target.value }
                            : undefined,
                        )
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.row}>
              <input
                className={styles.input}
                placeholder="Keyword (e.g. flying)"
                value={adv.keyword ?? ""}
                onChange={(e) => setAdvField("keyword", e.target.value)}
              />
              <select
                className={styles.select}
                value={adv.format ?? ""}
                onChange={(e) => setAdvField("format", e.target.value)}
              >
                <option value="">Any format</option>
                <option value="commander">Legal in Commander</option>
              </select>
            </div>
            <div>
              <div className={styles.syntaxNote}>
                We auto-convert this form to Scryfall syntax:
              </div>
              <div className={styles.syntaxPreview}>
                {compiledQuery || "—"}
              </div>
            </div>
            <Button type="submit" variant="primary" size="sm" disabled={!compiledQuery}>
              Search
            </Button>
          </form>
          <div className={styles.results}>
            <Results query={advQuery} onAdd={onAdd} />
          </div>
        </Tabs.Content>

        {/* Syntax */}
        <Tabs.Content value="syntax" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <form className={styles.tabBody} onSubmit={runSyntax}>
            <input
              className={styles.input}
              style={{ fontFamily: "var(--font-mono)" }}
              placeholder='e.g. t:dragon id<=rg cmc<4 o:"flying"'
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              aria-label="Scryfall query"
            />
            <div className={styles.syntaxNote}>
              Full Scryfall syntax — o: text · t: type · id: identity · cmc: ·
              is:commander · otag: and more.
            </div>
            <Button type="submit" variant="primary" size="sm">
              Search
            </Button>
          </form>
          <div className={styles.results}>
            <Results query={rawQuery} onAdd={onAdd} />
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}
