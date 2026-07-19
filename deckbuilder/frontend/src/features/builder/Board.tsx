/**
 * The Stacks board (PLAN §11 / DESIGN §6.3): columns per group, fanned card
 * rows in Stacks view (hover/focus expands the card), List and Grid views.
 * Empty category columns render as labelled wells (they exist deck-level).
 */
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { GameCard } from "../../components/mtg/GameCard";
import { ManaCost } from "../../components/mtg/ManaCost";
import type { DeckCardRow, DeckFull } from "../../lib/types";
import type { BoardColumn, ViewAs } from "./grouping";
import { columnQty } from "./grouping";
import styles from "./Board.module.css";

export interface CardActions {
  setQuantity: (row: DeckCardRow, quantity: number) => void;
  remove: (row: DeckCardRow) => void;
  moveBoard: (row: DeckCardRow, board: string) => void;
  moveCategory: (row: DeckCardRow, categoryId: string | null) => void;
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
}: {
  row: DeckCardRow;
  deck: DeckFull;
  actions: CardActions;
  className?: string;
}) {
  return (
    <DropdownMenu.Root>
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
        <DropdownMenu.Content className={styles.menuContent} sideOffset={6}>
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
          {deck.categories.length > 0 && (
            <>
              <div className={styles.menuSep} />
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
            </>
          )}
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

function QtyControls({
  row,
  actions,
}: {
  row: DeckCardRow;
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
        onClick={() => actions.setQuantity(row, row.quantity + 1)}
      >
        +
      </button>
    </>
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

export function Board({
  deck,
  columns,
  view,
  actions,
}: {
  deck: DeckFull;
  columns: BoardColumn[];
  view: ViewAs;
  actions: CardActions;
}) {
  return (
    <div className={styles.board}>
      {columns.map((col) => (
        <section
          key={col.key}
          className={`${styles.column} ${view === "list" ? styles.columnWide : ""}`}
          aria-label={col.name}
        >
          <ColumnHeader col={col} />

          {col.rows.length === 0 ? (
            <div className={styles.emptyWell}>empty</div>
          ) : view === "stacks" ? (
            <div className={styles.stack}>
              {col.rows.map((row) => (
                <div key={row.id} className={styles.fanRow} tabIndex={0}>
                  <GameCard card={row.card} quantity={row.quantity} />
                  <div className={styles.rowControls}>
                    <QtyControls row={row} actions={actions} />
                    <RowMenu row={row} deck={deck} actions={actions} />
                  </div>
                </div>
              ))}
            </div>
          ) : view === "grid" ? (
            <div className={styles.gridWrap}>
              {col.rows.map((row) => (
                <div key={row.id} className={styles.fanRow} tabIndex={0}>
                  <GameCard card={row.card} quantity={row.quantity} />
                  <div className={styles.rowControls}>
                    <QtyControls row={row} actions={actions} />
                    <RowMenu row={row} deck={deck} actions={actions} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {col.rows.map((row) => (
                <div key={row.id} className={styles.listRow}>
                  <span className={styles.listQty}>{row.quantity}</span>
                  <span className={styles.listName}>{row.card.name}</span>
                  <ManaCost cost={row.card.mana_cost} className={styles.listCost} />
                  <span className={styles.listControls}>
                    <QtyControls row={row} actions={actions} />
                    <RowMenu row={row} deck={deck} actions={actions} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
