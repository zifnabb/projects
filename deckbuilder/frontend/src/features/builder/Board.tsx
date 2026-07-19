/**
 * The Stacks board (PLAN §11 / DESIGN §6.3): columns per group, fanned card
 * rows in Stacks view (hover/focus expands the card), List and Grid views.
 * Empty category columns render as labelled wells (they exist deck-level).
 */
import { useState, type DragEvent } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { GameCard } from "../../components/mtg/GameCard";
import { ManaCost } from "../../components/mtg/ManaCost";
import type { DeckCardRow, DeckFull } from "../../lib/types";
import type { BoardColumn, GroupBy, ViewAs } from "./grouping";
import { columnQty } from "./grouping";
import styles from "./Board.module.css";

export interface CardActions {
  setQuantity: (row: DeckCardRow, quantity: number) => void;
  remove: (row: DeckCardRow) => void;
  moveBoard: (row: DeckCardRow, board: string) => void;
  moveCategory: (row: DeckCardRow, categoryId: string | null) => void;
  /** drag-and-drop: one PATCH moving board and/or category together */
  drop: (row: DeckCardRow, body: { board?: string; category_id?: string | null }) => void;
  /** click a card → open the card detail panel (PLAN §9) */
  open: (row: DeckCardRow) => void;
}

const DRAG_MIME = "application/x-vermilion-row";

function startDrag(e: DragEvent, row: DeckCardRow) {
  e.dataTransfer.setData(DRAG_MIME, row.id);
  e.dataTransfer.effectAllowed = "move";
}

/** What dropping on this column means — null = not a drop target
 * (type/cmc/color groupings describe the card, you can't drag it there). */
function dropBodyFor(
  col: BoardColumn,
  group: GroupBy,
): { board?: string; category_id?: string | null } | null {
  if (col.kind === "commander") return { board: "command" };
  if (col.kind === "side") return { board: "side" };
  if (col.kind === "maybe") return { board: "maybe" };
  if (col.key === "main") return { board: "main" };
  if (group === "categories") {
    return { board: "main", category_id: col.categoryId ?? null };
  }
  return null;
}

const BOARD_TARGETS: { key: string; label: string }[] = [
  { key: "main", label: "Mainboard" },
  { key: "side", label: "Sideboard" },
  { key: "maybe", label: "Maybeboard" },
  { key: "command", label: "Command zone" },
];

function RowMenu({
  row,
  deck,
  actions,
  className,
  onOpenChange,
}: {
  row: DeckCardRow;
  deck: DeckFull;
  actions: CardActions;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DropdownMenu.Root onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`${styles.ctlButton} ${className ?? ""}`}
          aria-label={`${row.card.name} options`}
        >
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menuContent}
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={12}
        >
          {deck.categories.length > 0 && (
            <>
              <div className={styles.menuLabel}>Category</div>
              {deck.categories.map((cat) => (
                <DropdownMenu.Item
                  key={cat.id}
                  className={styles.menuItem}
                  data-disabled={row.category_id === cat.id || undefined}
                  disabled={row.category_id === cat.id}
                  onSelect={() => actions.moveCategory(row, cat.id)}
                >
                  {cat.name}
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Item
                className={styles.menuItem}
                disabled={row.category_id == null}
                onSelect={() => actions.moveCategory(row, null)}
              >
                Uncategorized
              </DropdownMenu.Item>
              <div className={styles.menuSep} />
            </>
          )}
          <div className={styles.menuLabel}>Board</div>
          {BOARD_TARGETS.filter((b) => b.key !== row.board).map((b) => (
            <DropdownMenu.Item
              key={b.key}
              className={styles.menuItem}
              onSelect={() => actions.moveBoard(row, b.key)}
            >
              {b.label}
            </DropdownMenu.Item>
          ))}
          <div className={styles.menuSep} />
          <DropdownMenu.Item
            className={`${styles.menuItem} ${styles.menuDanger}`}
            onSelect={() => actions.remove(row)}
          >
            Remove from deck
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Singleton formats: only basics / "any number" cards may exceed 1
 * (user rule: commander + non-basic → max 1, no stepper). */
function allowsMultiples(deck: DeckFull, row: DeckCardRow): boolean {
  return !deck.format_info.singleton || row.card.multiples_ok === true;
}

/** Show the stepper when stepping is meaningful — always for multiples-ok
 * cards, and for capped cards only while over-quantity (to step back down). */
function canStep(deck: DeckFull, row: DeckCardRow): boolean {
  return allowsMultiples(deck, row) || row.quantity > 1;
}

function QtyControls({
  row,
  allowIncrease,
  actions,
}: {
  row: DeckCardRow;
  allowIncrease: boolean;
  actions: CardActions;
}) {
  return (
    <>
      <button
        type="button"
        className={styles.ctlButton}
        aria-label="Decrease quantity"
        onClick={() =>
          row.quantity <= 1
            ? actions.remove(row)
            : actions.setQuantity(row, row.quantity - 1)
        }
      >
        −
      </button>
      <span className={styles.ctlQty}>{row.quantity}</span>
      <button
        type="button"
        className={styles.ctlButton}
        aria-label="Increase quantity"
        disabled={!allowIncrease}
        style={!allowIncrease ? { opacity: 0.35, cursor: "default" } : undefined}
        onClick={() => allowIncrease && actions.setQuantity(row, row.quantity + 1)}
      >
        +
      </button>
    </>
  );
}

/** Card tile (Stacks fan / Grid) — stays expanded while its ⋯ menu is open,
 * so the menu never floats over a collapsed card. */
function CardTile({
  row,
  deck,
  actions,
}: {
  row: DeckCardRow;
  deck: DeckFull;
  actions: CardActions;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const illegal = (row.issues?.length ?? 0) > 0;
  return (
    <div
      className={`${styles.fanRow} ${menuOpen ? styles.rowOpen : ""} ${illegal ? styles.rowIllegal : ""}`}
      tabIndex={0}
      role="button"
      title={illegal ? row.issues!.join(" · ") : undefined}
      draggable
      onDragStart={(e) => startDrag(e, row)}
      onClick={() => actions.open(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter") actions.open(row);
      }}
    >
      <GameCard card={row.card} quantity={row.quantity} />
      <div className={styles.rowControls} onClick={(e) => e.stopPropagation()}>
        {canStep(deck, row) && (
          <QtyControls
            row={row}
            allowIncrease={allowsMultiples(deck, row)}
            actions={actions}
          />
        )}
        <RowMenu row={row} deck={deck} actions={actions} onOpenChange={setMenuOpen} />
      </div>
    </div>
  );
}

function ListRow({
  row,
  deck,
  actions,
}: {
  row: DeckCardRow;
  deck: DeckFull;
  actions: CardActions;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const illegal = (row.issues?.length ?? 0) > 0;
  return (
    <div
      className={`${styles.listRow} ${menuOpen ? styles.rowOpen : ""} ${illegal ? styles.rowIllegal : ""}`}
      role="button"
      tabIndex={0}
      title={illegal ? row.issues!.join(" · ") : undefined}
      draggable
      onDragStart={(e) => startDrag(e, row)}
      onClick={() => actions.open(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter") actions.open(row);
      }}
    >
      <span className={styles.listQty}>{row.quantity}</span>
      <span className={styles.listName}>{row.card.name}</span>
      <ManaCost cost={row.card.mana_cost} className={styles.listCost} />
      <span className={styles.listControls} onClick={(e) => e.stopPropagation()}>
        {canStep(deck, row) && (
          <QtyControls
            row={row}
            allowIncrease={allowsMultiples(deck, row)}
            actions={actions}
          />
        )}
        <RowMenu row={row} deck={deck} actions={actions} onOpenChange={setMenuOpen} />
      </span>
    </div>
  );
}

function ColumnHeader({ col }: { col: BoardColumn }) {
  const qty = columnQty(col);
  const hasRange = col.targetMin != null || col.targetMax != null;
  const under = col.targetMin != null && qty < col.targetMin;
  const over = col.targetMax != null && qty > col.targetMax;
  return (
    <div className={styles.colHeader}>
      <span className={styles.colName}>
        {col.name}
        {hasRange && ` (${col.targetMin ?? 0}–${col.targetMax ?? "∞"})`}
      </span>
      <span
        className={`${styles.colQty} ${under || over ? styles.outOfRange : ""}`}
      >
        {qty}
      </span>
    </div>
  );
}

const BOARD_CLASS: Record<ViewAs, string> = {
  stacks: "boardStacks",
  list: "boardList",
  grid: "boardGrid",
};

/** One board column — a drop target when the grouping gives the drop a
 * meaning (category columns, boards). */
function Column({
  col,
  group,
  deck,
  view,
  actions,
}: {
  col: BoardColumn;
  group: GroupBy;
  deck: DeckFull;
  view: ViewAs;
  actions: CardActions;
}) {
  const [dragOver, setDragOver] = useState(false);
  const dropBody = dropBodyFor(col, group);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const rowId = e.dataTransfer.getData(DRAG_MIME);
    const row = deck.cards.find((r) => r.id === rowId);
    if (!row || !dropBody) return;
    const sameBoard = dropBody.board === undefined || dropBody.board === row.board;
    const sameCategory =
      dropBody.category_id === undefined || dropBody.category_id === row.category_id;
    if (sameBoard && sameCategory) return; // dropped where it already lives
    actions.drop(row, dropBody);
  }

  return (
    <section
      className={`${styles.column} ${dragOver ? styles.dropActive : ""}`}
      aria-label={col.name}
      onDragOver={
        dropBody
          ? (e) => {
              if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={dropBody ? () => setDragOver(false) : undefined}
      onDrop={dropBody ? onDrop : undefined}
    >
      <ColumnHeader col={col} />

      {col.rows.length === 0 ? (
        <div className={styles.emptyWell}>
          {dropBody ? "drop cards here" : "empty"}
        </div>
      ) : view === "stacks" ? (
        <div className={styles.stack}>
          {col.rows.map((row) => (
            <CardTile key={row.id} row={row} deck={deck} actions={actions} />
          ))}
        </div>
      ) : view === "grid" ? (
        <div className={styles.gridWrap}>
          {col.rows.map((row) => (
            <CardTile key={row.id} row={row} deck={deck} actions={actions} />
          ))}
        </div>
      ) : (
        <div>
          {col.rows.map((row) => (
            <ListRow key={row.id} row={row} deck={deck} actions={actions} />
          ))}
        </div>
      )}
    </section>
  );
}

export function Board({
  deck,
  columns,
  group,
  view,
  actions,
}: {
  deck: DeckFull;
  columns: BoardColumn[];
  group: GroupBy;
  view: ViewAs;
  actions: CardActions;
}) {
  return (
    <div className={styles[BOARD_CLASS[view]]}>
      {columns.map((col) => (
        <Column
          key={col.key}
          col={col}
          group={group}
          deck={deck}
          view={view}
          actions={actions}
        />
      ))}
    </div>
  );
}
