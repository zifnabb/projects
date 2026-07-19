/**
 * Control toolbar (PLAN §11): Quick add (type-to-add, Cmd+') · View as ·
 * Group by · Sort by. Card search + local filter arrive with the Search-rail
 * slice. View/group/sort live in URL params (shareable, survives reload).
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ManaCost } from "../../components/mtg/ManaCost";
import type { AutocompleteResult } from "../../lib/types";
import { useAutocomplete } from "../decks/api";
import type { GroupBy, SortBy, ViewAs } from "./grouping";
import styles from "./Toolbar.module.css";

function useDebounced(value: string, ms = 180): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function QuickAdd({ onAdd }: { onAdd: (card: AutocompleteResult) => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(q);
  const { data } = useAutocomplete(debounced, false, 7);
  const results = q.trim().length >= 2 ? (data?.results ?? []) : [];

  // Cmd+' focuses quick-add (PLAN §11)
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "'") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function pick(card: AutocompleteResult) {
    onAdd(card);
    setQ("");
    setActive(0);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(results[Math.min(active, results.length - 1)]);
    } else if (e.key === "Escape") {
      setQ("");
    }
  }

  return (
    <div className={styles.quickAdd}>
      <input
        ref={inputRef}
        className={styles.quickAddInput}
        placeholder="Quick add…  (⌘')"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        aria-label="Quick add a card"
        autoComplete="off"
      />
      {results.length > 0 && (
        <div className={styles.results} role="listbox">
          {results.map((r, i) => (
            <button
              key={r.oracle_id}
              type="button"
              className={styles.resultRow}
              data-active={i === active}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(r)}
            >
              <span className={styles.resultName}>{r.name}</span>
              <ManaCost cost={r.mana_cost} className={styles.resultCost} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Toolbar({
  view,
  group,
  sort,
  hasCategories,
  onView,
  onGroup,
  onSort,
  onAdd,
}: {
  view: ViewAs;
  group: GroupBy;
  sort: SortBy;
  hasCategories: boolean;
  onView: (v: ViewAs) => void;
  onGroup: (g: GroupBy) => void;
  onSort: (s: SortBy) => void;
  onAdd: (card: AutocompleteResult) => void;
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.group}>
        <span className={styles.groupLabel}>Add card</span>
        <QuickAdd onAdd={onAdd} />
      </div>

      <div className={styles.group}>
        <span className={styles.groupLabel}>View as</span>
        <select
          className={styles.select}
          value={view}
          onChange={(e) => onView(e.target.value as ViewAs)}
          aria-label="View as"
        >
          <option value="stacks">Stacks</option>
          <option value="list">List</option>
          <option value="grid">Grid</option>
        </select>
      </div>

      <div className={styles.group}>
        <span className={styles.groupLabel}>Group by</span>
        <select
          className={styles.select}
          value={group}
          onChange={(e) => onGroup(e.target.value as GroupBy)}
          aria-label="Group by"
        >
          {hasCategories && <option value="categories">Categories</option>}
          <option value="type">Type</option>
          <option value="cmc">Mana value</option>
          <option value="color">Color</option>
          <option value="board">Board</option>
        </select>
      </div>

      <div className={styles.group}>
        <span className={styles.groupLabel}>Sort by</span>
        <select
          className={styles.select}
          value={sort}
          onChange={(e) => onSort(e.target.value as SortBy)}
          aria-label="Sort by"
        >
          <option value="mv">Mana value</option>
          <option value="name">Name</option>
          <option value="type">Type</option>
        </select>
      </div>
    </div>
  );
}
