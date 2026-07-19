/**
 * Deck builder (PLAN §11 / DESIGN §8.4) — Builder shell: deck header (with
 * clone/export/import/visibility), control toolbar, the board, and the
 * collapsible Search (left) + Stats (right) rails. Card clicks open the
 * card detail panel (§9). View/group/sort/rails persist in URL params.
 */
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { DeckCardRow } from "../../lib/types";
import { decksApi, useDeck, useDeckMutation } from "../decks/api";
import { CardPanel, type CardPanelState } from "../cardpanel/CardPanel";
import { SearchPanel } from "../search/SearchPanel";
import { Board, type CardActions } from "./Board";
import { CategoryManager } from "./CategoryManager";
import { DeckHeader } from "./DeckHeader";
import { ImportModal } from "./ImportModal";
import { StatsSidebar } from "./StatsSidebar";
import { Toolbar } from "./Toolbar";
import {
  buildColumns,
  defaultGroupBy,
  type GroupBy,
  type SortBy,
  type ViewAs,
} from "./grouping";
import styles from "./BuilderPage.module.css";

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BuilderPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const { data: deck, isLoading } = useDeck(deckId);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [openCard, setOpenCard] = useState<CardPanelState | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [injectedQuery, setInjectedQuery] = useState<string | null>(null);

  const rename = useDeckMutation(deckId!, (name: string) =>
    decksApi.update(deckId!, { name }),
  );
  const addCard = useDeckMutation(deckId!, (card: { oracle_id: string }) =>
    decksApi.addCard(deckId!, { oracle_id: card.oracle_id }),
  );
  const updateCard = useDeckMutation(
    deckId!,
    (args: {
      rowId: string;
      body: Partial<{ board: string; quantity: number; category_id: string | null; printing_id: string | null }>;
    }) => decksApi.updateCard(deckId!, args.rowId, args.body),
  );
  const removeCard = useDeckMutation(deckId!, (rowId: string) =>
    decksApi.removeCard(deckId!, rowId),
  );
  const setCommander = useDeckMutation(deckId!, (oracleId: string | null) =>
    decksApi.update(deckId!, { commander_oracle_id: oracleId }),
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
  // quick-add stays inside the deck's color identity once a commander is set
  // ("" = colorless commander -> colorless cards only)
  const quickAddIdentity =
    deck.format_info.enforce_color_identity && deck.commander_oracle_id
      ? deck.color_identity.join("")
      : undefined;
  const searchOpen = params.get("search") === "1";
  const statsOpen = params.get("stats") === "1";
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
    drop: (row: DeckCardRow, body: { board?: string; category_id?: string | null }) =>
      updateCard.mutate({ rowId: row.id, body }),
    open: (row: DeckCardRow) => setOpenCard({ oracleId: row.oracle_id, row }),
  };

  async function handleExport(fmt: "text" | "arena" | "json") {
    const result = await decksApi.export(deck!.id, fmt);
    await navigator.clipboard.writeText(result.content).catch(() => undefined);
    download(result.filename, result.content);
  }

  async function handleClone() {
    const clone = await decksApi.clone(deck!.id);
    qc.invalidateQueries({ queryKey: ["decks"] });
    qc.setQueryData(["deck", clone.id], clone);
    navigate(`/decks/${clone.id}`);
  }

  async function handleVisibility(v: "private" | "shared") {
    await decksApi.setVisibility(deck!.id, v);
    qc.invalidateQueries({ queryKey: ["deck", deck!.id] });
    qc.invalidateQueries({ queryKey: ["decks"] });
  }

  return (
    <div>
      <DeckHeader
        deck={deck}
        onRename={(name) => rename.mutate(name)}
        onClone={() => void handleClone()}
        onExport={(fmt) => void handleExport(fmt)}
        onImport={() => setImportOpen(true)}
        onSetVisibility={(v) => void handleVisibility(v)}
      />
      <Toolbar
        view={view}
        group={group}
        sort={sort}
        hasCategories={hasCategories}
        searchOpen={searchOpen}
        statsOpen={statsOpen}
        identity={quickAddIdentity}
        onView={(v) => setParam("view", v)}
        onGroup={(g) => setParam("group", g)}
        onSort={(s) => setParam("sort", s)}
        onAdd={(card) => addCard.mutate(card)}
        onToggleSearch={() => setParam("search", searchOpen ? "0" : "1")}
        onToggleStats={() => setParam("stats", statsOpen ? "0" : "1")}
        onManageCategories={() => setCategoriesOpen(true)}
      />
      <div className={styles.workspace}>
        {searchOpen && (
          <SearchPanel
            deck={deck}
            onClose={() => setParam("search", "0")}
            onAdd={(card) => addCard.mutate(card)}
            onOpenCard={(card) => setOpenCard({ oracleId: card.oracle_id })}
            injectedQuery={injectedQuery}
          />
        )}
        <main className={styles.boardArea}>
          <Board deck={deck} columns={columns} group={group} view={view} actions={actions} />
        </main>
        {statsOpen && (
          <StatsSidebar
            deck={deck}
            columns={columns}
            onClose={() => setParam("stats", "0")}
          />
        )}
      </div>

      <CardPanel
        state={openCard}
        deck={deck}
        onClose={() => setOpenCard(null)}
        actions={{
          setQuantity: actions.setQuantity,
          remove: actions.remove,
          moveBoard: actions.moveBoard,
          moveCategory: actions.moveCategory,
          setPrinting: (row, printingId) =>
            updateCard.mutate({ rowId: row.id, body: { printing_id: printingId } }),
          setCommander: (oracleId) => setCommander.mutate(oracleId),
          addToDeck: (oracleId) => addCard.mutate({ oracle_id: oracleId }),
          runQuery: (query) => {
            setInjectedQuery(query);
            setParam("search", "1");
          },
        }}
      />

      <ImportModal open={importOpen} onOpenChange={setImportOpen} deckId={deck.id} />
      <CategoryManager
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        deck={deck}
      />
    </div>
  );
}
