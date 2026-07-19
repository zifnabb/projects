/**
 * Unified top-bar search (PLAN §10, Moxfield lineage): Cards ↔ Decks toggle.
 * Cards → local autocomplete → card detail panel (bare mode, deck-picker add).
 * Decks → YOUR decks only → navigate to the builder.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColorPipBar } from "../mtg/ColorPipBar";
import { ManaCost } from "../mtg/ManaCost";
import { useAutocomplete, useDecks } from "../../features/decks/api";
import styles from "./UnifiedSearch.module.css";

function useDebounced(value: string, ms = 180): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function UnifiedSearch({
  onOpenCard,
}: {
  onOpenCard: (oracleId: string) => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"cards" | "decks">("cards");
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const debounced = useDebounced(q);
  const cards = useAutocomplete(mode === "cards" ? debounced : "", false, 8);
  const { data: decks } = useDecks();

  // close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setQ("");
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const deckMatches =
    mode === "decks" && q.trim().length >= 1 && decks
      ? decks
          .filter(
            (d) =>
              d.name.toLowerCase().includes(q.toLowerCase()) ||
              d.format.toLowerCase().includes(q.toLowerCase()) ||
              d.tags.some((t) => t.toLowerCase().includes(q.toLowerCase())),
          )
          .slice(0, 8)
      : [];
  const cardMatches =
    mode === "cards" && q.trim().length >= 2 ? (cards.data?.results ?? []) : [];

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.modeToggle} role="tablist" aria-label="Search type">
        <button
          type="button"
          className={styles.mode}
          data-active={mode === "cards"}
          onClick={() => setMode("cards")}
        >
          Cards
        </button>
        <button
          type="button"
          className={styles.mode}
          data-active={mode === "decks"}
          onClick={() => setMode("decks")}
        >
          Decks
        </button>
      </div>
      <input
        className={styles.input}
        placeholder={mode === "cards" ? "Find a card…" : "Find one of your decks…"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={mode === "cards" ? "Search cards" : "Search your decks"}
      />
      {(cardMatches.length > 0 || deckMatches.length > 0) && (
        <div className={styles.results}>
          {cardMatches.map((c) => (
            <button
              key={c.oracle_id}
              type="button"
              className={styles.row}
              onClick={() => {
                onOpenCard(c.oracle_id);
                setQ("");
              }}
            >
              <ColorPipBar identity={c.color_identity} />
              <span className={styles.rowName}>{c.name}</span>
              <ManaCost cost={c.mana_cost} className={styles.rowMeta} />
            </button>
          ))}
          {deckMatches.map((d) => (
            <button
              key={d.id}
              type="button"
              className={styles.row}
              onClick={() => {
                navigate(`/decks/${d.id}`);
                setQ("");
              }}
            >
              <ColorPipBar identity={d.color_identity} />
              <span className={styles.rowName}>{d.name}</span>
              <span className={styles.rowMeta}>
                {d.format} · {d.size}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
