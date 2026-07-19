/**
 * Home dashboard (PLAN §10 / DESIGN §8.2) — YOUR decks only, no community.
 * Client-side sort/filter (tiny scale); the unified Cards↔Decks top-bar search
 * lands with the card-panel slice.
 */
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import type { AppShellContext } from "../../components/shell/AppShell";
import type { DeckListItem } from "../../lib/types";
import { useDecks } from "../decks/api";
import { DeckCard } from "./DeckCard";
import styles from "./HomePage.module.css";

type SortKey = "updated" | "name" | "format";

function sortDecks(decks: DeckListItem[], key: SortKey): DeckListItem[] {
  const copy = [...decks];
  switch (key) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "format":
      return copy.sort((a, b) => a.format.localeCompare(b.format));
    default:
      return copy; // API returns updated-desc already
  }
}

export function HomePage() {
  const { openNewDeck } = useOutletContext<AppShellContext>();
  const { data: decks, isLoading } = useDecks();
  const [sort, setSort] = useState<SortKey>("updated");
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    if (!decks) return [];
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? decks.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.format.toLowerCase().includes(q) ||
            d.tags.some((t) => t.toLowerCase().includes(q)),
        )
      : decks;
    return sortDecks(filtered, sort);
  }, [decks, filter, sort]);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.headerRow}>
          <h2 className={styles.title}>Your decks</h2>
        </div>
        <div className={styles.grid}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      </div>
    );
  }

  if (!decks || decks.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <h1 className={styles.emptyTitle}>Build your first deck</h1>
          <p className={styles.emptyText}>
            Pick a commander, start from a deckbuilding template, and the
            skeleton will guide you the rest of the way.
          </p>
          <Button variant="primary" size="lg" onClick={openNewDeck}>
            <Plus size={18} aria-hidden="true" />
            New Deck
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Your decks</h2>
        <span className={styles.spacer} />
        <div className={styles.controls}>
          <TextField
            placeholder="Filter decks…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            trailing={<Search size={14} aria-hidden="true" />}
            aria-label="Filter decks"
          />
          <select
            className={styles.select}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort decks"
          >
            <option value="updated">Recently updated</option>
            <option value="name">Name</option>
            <option value="format">Format</option>
          </select>
        </div>
      </div>

      <div className={styles.grid}>
        {visible.map((d) => (
          <DeckCard key={d.id} deck={d} />
        ))}
      </div>
    </div>
  );
}
