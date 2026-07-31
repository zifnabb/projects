/**
 * Category manager (user feedback 2026-07-19): add / rename / retarget /
 * delete / drag-reorder deck categories. Rows commit on blur or Enter;
 * deleting a category moves its cards to Uncategorized (server FK SET NULL).
 */
import { useState, type DragEvent, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import type { DeckCategoryOut, DeckFull } from "../../lib/types";
import { decksApi, useDeckMutation, type CategoryBody } from "../decks/api";
import styles from "./CategoryManager.module.css";

function toInt(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const CAT_DRAG_MIME = "application/x-vermilion-category";

function CategoryRow({
  cat,
  cardCount,
  dropIndicator,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  cat: DeckCategoryOut;
  cardCount: number;
  /** another category is being dragged over this row */
  dropIndicator: boolean;
  onSave: (body: CategoryBody) => void;
  onDelete: () => void;
  /** touch/keyboard reorder path (drag doesn't fire on touch) */
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}) {
  const [name, setName] = useState(cat.name);
  const [min, setMin] = useState(cat.target_min?.toString() ?? "");
  const [max, setMax] = useState(cat.target_max?.toString() ?? "");

  function commit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(cat.name); // never save an empty name
      return;
    }
    const body: CategoryBody = {
      name: trimmed,
      target_min: toInt(min),
      target_max: toInt(max),
      color_tag: cat.color_tag,
    };
    const dirty =
      body.name !== cat.name ||
      body.target_min !== cat.target_min ||
      body.target_max !== cat.target_max;
    if (dirty) onSave(body);
  }

  function onEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  }

  return (
    <div
      className={`${styles.row} ${dropIndicator ? styles.rowDropTarget : ""}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <span
        className={styles.grip}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        aria-label={`Reorder ${cat.name}`}
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </span>
      {/* touch/keyboard reorder — HTML5 drag doesn't fire on touch */}
      <span className={styles.moveButtons}>
        <button
          type="button"
          className={styles.moveButton}
          onClick={onMoveUp}
          disabled={!canMoveUp}
          aria-label={`Move ${cat.name} up`}
          title="Move up"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          className={styles.moveButton}
          onClick={onMoveDown}
          disabled={!canMoveDown}
          aria-label={`Move ${cat.name} down`}
          title="Move down"
        >
          <ChevronDown size={14} />
        </button>
      </span>
      <input
        className={styles.nameInput}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={onEnter}
        aria-label={`Rename ${cat.name}`}
      />
      <span className={styles.count}>
        {cardCount} {cardCount === 1 ? "card" : "cards"}
      </span>
      <input
        className={styles.targetInput}
        value={min}
        onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={onEnter}
        placeholder="min"
        inputMode="numeric"
        aria-label={`${cat.name} target minimum`}
      />
      <span className={styles.targetSep}>–</span>
      <input
        className={styles.targetInput}
        value={max}
        onChange={(e) => setMax(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={onEnter}
        placeholder="max"
        inputMode="numeric"
        aria-label={`${cat.name} target maximum`}
      />
      <button
        type="button"
        className={styles.deleteButton}
        onClick={onDelete}
        aria-label={`Delete ${cat.name}`}
        title="Delete category"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export function CategoryManager({
  open,
  onOpenChange,
  deck,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deck: DeckFull;
}) {
  const [newName, setNewName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const addCategory = useDeckMutation(deck.id, (body: CategoryBody) =>
    decksApi.addCategory(deck.id, body),
  );
  const reorder = useDeckMutation(deck.id, (order: string[]) =>
    decksApi.reorderCategories(deck.id, order),
  );
  const updateCategory = useDeckMutation(
    deck.id,
    (args: { categoryId: string; body: CategoryBody }) =>
      decksApi.updateCategory(deck.id, args.categoryId, args.body),
  );
  const deleteCategory = useDeckMutation(deck.id, (categoryId: string) =>
    decksApi.deleteCategory(deck.id, categoryId),
  );

  const counts = new Map<string, number>();
  for (const row of deck.cards) {
    if (row.category_id) {
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + row.quantity);
    }
  }

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    const exists = deck.categories.some(
      (c) => c.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) return;
    addCategory.mutate({ name });
    setNewName("");
  }

  /** drop the dragged category in front of `targetId` */
  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const order = deck.categories.map((c) => c.id).filter((id) => id !== dragId);
    order.splice(order.indexOf(targetId), 0, dragId);
    reorder.mutate(order);
    setDragId(null);
    setOverId(null);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <div className={styles.titleRow}>
            <Dialog.Title asChild>
              <h1 className={styles.title}>Categories</h1>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className={styles.close} aria-label="Close">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          {deck.categories.length > 0 ? (
            <div
              className={styles.list}
              // dropping below the rows moves the dragged category to the end
              onDragOver={(e) => {
                if (dragId) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!dragId) return;
                const order = deck.categories
                  .map((c) => c.id)
                  .filter((id) => id !== dragId);
                order.push(dragId);
                reorder.mutate(order);
                setDragId(null);
                setOverId(null);
              }}
            >
              <div className={styles.headerRow}>
                <span className={styles.headerName}>Name</span>
                <span className={styles.headerTargets}>Target (min–max)</span>
              </div>
              {deck.categories.map((cat, i) => (
                <CategoryRow
                  // remount on save so inputs resync with the server response
                  key={`${cat.id}:${cat.name}:${cat.target_min}:${cat.target_max}`}
                  cat={cat}
                  cardCount={counts.get(cat.id) ?? 0}
                  dropIndicator={overId === cat.id && dragId !== cat.id}
                  onSave={(body) =>
                    updateCategory.mutate({ categoryId: cat.id, body })
                  }
                  onDelete={() => deleteCategory.mutate(cat.id)}
                  canMoveUp={i > 0}
                  canMoveDown={i < deck.categories.length - 1}
                  onMoveUp={() => {
                    const order = deck.categories.map((c) => c.id);
                    [order[i - 1], order[i]] = [order[i], order[i - 1]];
                    reorder.mutate(order);
                  }}
                  onMoveDown={() => {
                    const order = deck.categories.map((c) => c.id);
                    [order[i], order[i + 1]] = [order[i + 1], order[i]];
                    reorder.mutate(order);
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(CAT_DRAG_MIME, cat.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragId(cat.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setOverId(cat.id);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation(); // container drop appends to the end
                    handleDrop(cat.id);
                  }}
                />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              No categories yet — add one below to start organizing the deck
              (e.g. Ramp, Removal, Card draw).
            </p>
          )}

          <form
            className={styles.addRow}
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
          >
            <input
              className={styles.addInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category name…"
              aria-label="New category name"
            />
            <Button type="submit" size="sm" disabled={!newName.trim()}>
              <Plus size={14} aria-hidden="true" />
              Add
            </Button>
          </form>

          <p className={styles.hint}>
            Drag the grip (or use the ↑↓ arrows) to reorder columns. Deleting a
            category doesn't remove its cards — they become Uncategorized. Assign
            cards from a card's ⋯ menu or by dragging them between columns.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
