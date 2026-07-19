/**
 * Category manager (user feedback 2026-07-19): add / rename / retarget /
 * delete deck categories. Rows commit on blur or Enter; deleting a category
 * moves its cards to Uncategorized (server FK SET NULL).
 */
import { useState, type KeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "../../components/ui/Button";
import type { DeckCategoryOut, DeckFull } from "../../lib/types";
import { decksApi, useDeckMutation, type CategoryBody } from "../decks/api";
import styles from "./CategoryManager.module.css";

function toInt(value: string): number | null {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function CategoryRow({
  cat,
  cardCount,
  onSave,
  onDelete,
}: {
  cat: DeckCategoryOut;
  cardCount: number;
  onSave: (body: CategoryBody) => void;
  onDelete: () => void;
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
    <div className={styles.row}>
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

  const addCategory = useDeckMutation(deck.id, (body: CategoryBody) =>
    decksApi.addCategory(deck.id, body),
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
            <div className={styles.list}>
              <div className={styles.headerRow}>
                <span className={styles.headerName}>Name</span>
                <span className={styles.headerTargets}>Target (min–max)</span>
              </div>
              {deck.categories.map((cat) => (
                <CategoryRow
                  // remount on save so inputs resync with the server response
                  key={`${cat.id}:${cat.name}:${cat.target_min}:${cat.target_max}`}
                  cat={cat}
                  cardCount={counts.get(cat.id) ?? 0}
                  onSave={(body) =>
                    updateCategory.mutate({ categoryId: cat.id, body })
                  }
                  onDelete={() => deleteCategory.mutate(cat.id)}
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
            Deleting a category doesn't remove its cards — they become
            Uncategorized. Assign cards from a card's ⋯ menu.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
