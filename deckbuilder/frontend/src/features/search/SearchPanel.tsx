/**
 * Search panel (PLAN §8 / DESIGN §8.6) — the extensible tab-shell. Two tabs:
 * Search (one merged form → compiled Scryfall syntax shown live as a teaching
 * strip) and Syntax (raw query). The form arrives prefilled from the deck
 * context — commander identity (at-most) + format legality — so results are
 * deck-legal by default; clear the fields to search wider.
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

  /* ---- Search tab (merged form, prefilled from deck context) ---- */
  const [adv, setAdv] = useState<AdvancedFilters>(() => {
    const initial: AdvancedFilters = {};
    if (identity) {
      initial.color_identity = { colors: identity, mode: "at-most" };
    }
    if (deck.format === "commander") initial.format = "commander";
    return initial;
  });
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

  function runSearch(e: FormEvent) {
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

      <Tabs.Root defaultValue="search" className={styles.tabsRoot}>
        <Tabs.List className={styles.tabList} aria-label="Search mode">
          <Tabs.Trigger className={styles.tab} value="search">
            Search
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.tab} value="syntax">
            Syntax
          </Tabs.Trigger>
        </Tabs.List>

        {/* Search — merged form */}
        <Tabs.Content value="search" className={styles.tabContent}>
          <form className={styles.tabBody} onSubmit={runSearch}>
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
                  placeholder="any colors"
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
              <div className={styles.syntaxPreview}>{compiledQuery || "—"}</div>
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
        <Tabs.Content value="syntax" className={styles.tabContent}>
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
