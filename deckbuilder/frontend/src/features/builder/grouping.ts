/**
 * Board grouping + sorting (PLAN §11). Pure functions: DeckFull → ordered
 * columns of card rows, per the Group-by / Sort-by controls.
 *
 * Boards vs categories are orthogonal: command-board cards always render in
 * their own leading "Commander" column; side/maybe get trailing columns.
 * Group-by applies to the MAIN board.
 */
import type { ColorLetter, DeckCardRow, DeckFull } from "../../lib/types";

export type GroupBy = "categories" | "type" | "cmc" | "color" | "board";
export type SortBy = "mv" | "name" | "type";
export type ViewAs = "stacks" | "list" | "grid";

export interface BoardColumn {
  key: string;
  name: string;
  /** category columns carry their range + id for the ⋯ menu */
  categoryId?: string;
  targetMin?: number | null;
  targetMax?: number | null;
  rows: DeckCardRow[];
  /** distinguishes the fixed board columns from group columns */
  kind: "commander" | "group" | "side" | "maybe";
}

const TYPE_ORDER = [
  "Battle",
  "Planeswalker",
  "Creature",
  "Sorcery",
  "Instant",
  "Artifact",
  "Enchantment",
  "Land",
  "Other",
];

export function primaryType(typeLine: string | null | undefined): string {
  const face = (typeLine ?? "").split(" // ")[0];
  const left = face.split("—")[0]; // strip subtypes
  for (const t of TYPE_ORDER) {
    if (left.includes(t)) return t;
  }
  return "Other";
}

function colorGroup(identity: ColorLetter[] | undefined): string {
  const ci = identity ?? [];
  if (ci.length === 0) return "Colorless";
  if (ci.length > 1) return "Multicolor";
  return { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" }[ci[0]];
}

const COLOR_ORDER = [
  "White",
  "Blue",
  "Black",
  "Red",
  "Green",
  "Multicolor",
  "Colorless",
];

export function sortRows(rows: DeckCardRow[], sort: SortBy): DeckCardRow[] {
  const copy = [...rows];
  const byName = (a: DeckCardRow, b: DeckCardRow) =>
    (a.card.name ?? "").localeCompare(b.card.name ?? "");
  switch (sort) {
    case "name":
      return copy.sort(byName);
    case "type":
      return copy.sort(
        (a, b) =>
          TYPE_ORDER.indexOf(primaryType(a.card.type_line)) -
            TYPE_ORDER.indexOf(primaryType(b.card.type_line)) || byName(a, b),
      );
    default: // mana value
      return copy.sort(
        (a, b) => (a.card.cmc ?? 0) - (b.card.cmc ?? 0) || byName(a, b),
      );
  }
}

export function buildColumns(
  deck: DeckFull,
  group: GroupBy,
  sort: SortBy,
): BoardColumn[] {
  const command = deck.cards.filter((c) => c.board === "command");
  const main = deck.cards.filter((c) => c.board === "main");
  const side = deck.cards.filter((c) => c.board === "side");
  const maybe = deck.cards.filter((c) => c.board === "maybe");

  const columns: BoardColumn[] = [];

  if (command.length > 0) {
    columns.push({
      key: "command",
      name: "Commander",
      rows: sortRows(command, sort),
      kind: "commander",
    });
  }

  if (group === "categories") {
    // deck-level categories exist even empty (template skeleton, PLAN §11);
    // the seeded "Commander" bucket is served by the command board column.
    for (const cat of deck.categories) {
      if (cat.name.toLowerCase() === "commander" && command.length > 0) continue;
      columns.push({
        key: `cat:${cat.id}`,
        name: cat.name,
        categoryId: cat.id,
        targetMin: cat.target_min,
        targetMax: cat.target_max,
        rows: sortRows(main.filter((c) => c.category_id === cat.id), sort),
        kind: "group",
      });
    }
    const uncategorized = main.filter(
      (c) => !c.category_id || !deck.categories.some((k) => k.id === c.category_id),
    );
    if (uncategorized.length > 0) {
      columns.push({
        key: "cat:none",
        name: "Uncategorized",
        rows: sortRows(uncategorized, sort),
        kind: "group",
      });
    }
  } else if (group === "board") {
    if (main.length > 0) {
      columns.push({ key: "main", name: "Mainboard", rows: sortRows(main, sort), kind: "group" });
    }
  } else {
    const keyFn =
      group === "type"
        ? (c: DeckCardRow) => primaryType(c.card.type_line)
        : group === "cmc"
          ? (c: DeckCardRow) => {
              const mv = Math.floor(c.card.cmc ?? 0);
              return mv >= 7 ? "7+" : String(mv);
            }
          : (c: DeckCardRow) => colorGroup(c.card.color_identity);

    const buckets = new Map<string, DeckCardRow[]>();
    for (const row of main) {
      const k = keyFn(row);
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(row);
    }

    const order =
      group === "type"
        ? TYPE_ORDER
        : group === "cmc"
          ? ["0", "1", "2", "3", "4", "5", "6", "7+"]
          : COLOR_ORDER;

    for (const name of order) {
      const rows = buckets.get(name);
      if (rows && rows.length > 0) {
        columns.push({
          key: `${group}:${name}`,
          name,
          rows: sortRows(rows, sort),
          kind: "group",
        });
      }
    }
  }

  if (side.length > 0) {
    columns.push({ key: "side", name: "Sideboard", rows: sortRows(side, sort), kind: "side" });
  }
  if (maybe.length > 0) {
    columns.push({ key: "maybe", name: "Maybeboard", rows: sortRows(maybe, sort), kind: "maybe" });
  }

  return columns;
}

/** Column qty = sum of quantities. */
export function columnQty(col: BoardColumn): number {
  return col.rows.reduce((n, r) => n + r.quantity, 0);
}

/** Default group-by: Categories when the deck has any, else Type (PLAN §11). */
export function defaultGroupBy(deck: DeckFull): GroupBy {
  return deck.categories.length > 0 ? "categories" : "type";
}
