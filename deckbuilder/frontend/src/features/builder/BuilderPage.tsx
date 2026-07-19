/**
 * Deck builder (PLAN §11 / DESIGN §8.4) — Builder shell slice 1: deck header,
 * control toolbar, and the Stacks board. Search rail, card detail panel, and
 * stats sidebar are the next slices. View/group/sort persist in URL params.
 */
import { useSearchParams } from "react-router-dom";
import { useParams } from "react-router-dom";
import type { DeckCardRow } from "../../lib/types";
import { decksApi, useDeck, useDeckMutation } from "../decks/api";
import { SearchPanel } from "../search/SearchPanel";
import { Board, type CardActions } from "./Board";
import { DeckHeader } from "./DeckHeader";
import { Toolbar } from "./Toolbar";
import {
  buildColumns,
  defaultGroupBy,
  type GroupBy,
  type SortBy,
  type ViewAs,
} from "./grouping";
import styles from "./BuilderPage.module.css";

export function BuilderPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { data: deck, isLoading } = useDeck(deckId);
  const [params, setParams] = useSearchParams();

  const rename = useDeckMutation(deckId!, (name: string) =>
    decksApi.update(deckId!, { name }),
  );
  const addCard = useDeckMutation(deckId!, (card: { oracle_id: string }) =>
    decksApi.addCard(deckId!, { oracle_id: card.oracle_id }),
  );
  const updateCard = useDeckMutation(
    deckId!,
    (args: { rowId: string; body: Partial<{ board: string; quantity: number; category_id: string | null }> }) =>
      decksApi.updateCard(deckId!, args.rowId, args.body),
  );
  const removeCard = useDeckMutation(deckId!, (rowId: string) =>
    decksApi.removeCard(deckId!, rowId),
  );

  if (isLoading || !deck) {
    return (
      <div className={styles.loading}>
        <div className={styles.skeletonHeader} />
        <div className={styles.skeletonBoard}>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={styles.skeletonColumn} />
          ))}
        </div>
      </div>
    );
  }

  const hasCategories = deck.categories.length > 0;
  const searchOpen = params.get("search") === "1";
  const view = (params.get("view") as ViewAs) || "stacks";
  const groupParam = params.get("group") as GroupBy | null;
  const group: GroupBy =
    groupParam && (groupParam !== "categories" || hasCategories)
      ? groupParam
      : defaultGroupBy(deck);
  const sort = (params.get("sort") as SortBy) || "mv";

  function setParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }

  const columns = buildColumns(deck, group, sort);

  const actions: CardActions = {
    setQuantity: (row: DeckCardRow, quantity: number) =>
      updateCard.mutate({ rowId: row.id, body: { quantity } }),
    remove: (row: DeckCardRow) => removeCard.mutate(row.id),
    moveBoard: (row: DeckCardRow, board: string) =>
      updateCard.mutate({ rowId: row.id, body: { board } }),
    moveCategory: (row: DeckCardRow, categoryId: string | null) =>
      updateCard.mutate({ rowId: row.id, body: { category_id: categoryId } }),
  };

  return (
    <div>
      <DeckHeader deck={deck} onRename={(name) => rename.mutate(name)} />
      <Toolbar
        view={view}
        group={group}
        sort={sort}
        hasCategories={hasCategories}
        searchOpen={searchOpen}
        onView={(v) => setParam("view", v)}
        onGroup={(g) => setParam("group", g)}
        onSort={(s) => setParam("sort", s)}
        onAdd={(card) => addCard.mutate(card)}
        onToggleSearch={() => setParam("search", searchOpen ? "0" : "1")}
      />
      <div className={styles.workspace}>
        {searchOpen && (
          <SearchPanel
            deck={deck}
            onClose={() => setParam("search", "0")}
            onAdd={(card) => addCard.mutate(card)}
          />
        )}
        <main className={styles.boardArea}>
          <Board deck={deck} columns={columns} view={view} actions={actions} />
        </main>
      </div>
    </div>
  );
}
